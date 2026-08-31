'use strict'

const { randomUUID } = require('crypto')
const { getPool } = require('../../../db/pool')
const accountsRepo = require('../../accounts/repo')
const categoriesRepo = require('../../categories/repo')
const recurringRepo = require('../../recurring/repo')
const { todayInBangkok } = require('../../../cron/dateUtil')
const { addInterval } = require('../../recurring/scheduler')
const { applyOp } = require('../ops')

const pool = getPool()

afterAll(async () => {
  await pool.end()
})

describe('applyOp — transactions', () => {
  let accountId
  let categoryId
  let txnId

  beforeEach(async () => {
    accountId = randomUUID()
    categoryId = randomUUID()
    txnId = randomUUID()
    await accountsRepo.create(pool, { id: accountId, name: 'Ops Test Account' })
    await categoriesRepo.create(pool, { id: categoryId, name: `Ops Test Category ${categoryId}` })
  })

  afterEach(async () => {
    await pool.query('DELETE FROM transactions WHERE id = ?', [txnId])
    await pool.query('DELETE FROM accounts WHERE id = ?', [accountId])
    await pool.query('DELETE FROM categories WHERE id = ?', [categoryId])
  })

  function txnPayload(overrides = {}) {
    return {
      id: txnId,
      type: 'expense',
      amount: 1000,
      categoryId,
      accountId,
      txnDate: '2026-07-10',
      updatedAt: '2026-07-10T09:00:00.000Z',
      ...overrides,
    }
  }

  it('create applies and returns status applied', async () => {
    const result = await applyOp(pool, { entity: 'transactions', action: 'create', payload: txnPayload() })
    expect(result).toEqual({ id: txnId, status: 'applied' })
  })

  it('a stale update is skipped (LWW)', async () => {
    await applyOp(pool, { entity: 'transactions', action: 'create', payload: txnPayload({ updatedAt: '2026-07-10T10:00:00.000Z' }) })
    const result = await applyOp(pool, {
      entity: 'transactions',
      action: 'update',
      payload: txnPayload({ updatedAt: '2026-07-10T09:00:00.000Z' }),
    })
    expect(result.status).toBe('skipped')
  })

  it('delete on an unknown id returns error NOT_FOUND', async () => {
    const result = await applyOp(pool, {
      entity: 'transactions',
      action: 'delete',
      payload: { id: randomUUID(), updatedAt: '2026-07-10T09:00:00.000Z' },
    })
    expect(result.status).toBe('error')
    expect(result.code).toBe('NOT_FOUND')
  })

  it('an invalid per-type field combination returns error VALIDATION_ERROR', async () => {
    const result = await applyOp(pool, {
      entity: 'transactions',
      action: 'create',
      payload: txnPayload({ categoryId: null }),
    })
    expect(result.status).toBe('error')
    expect(result.code).toBe('VALIDATION_ERROR')
  })

  it('a malformed updatedAt fails cleanly as one op error, not a thrown exception', async () => {
    const result = await applyOp(pool, {
      entity: 'transactions',
      action: 'create',
      payload: txnPayload({ updatedAt: 'not-a-date' }),
    })
    expect(result.status).toBe('error')
  })
})

describe('applyOp — simple entities (accounts)', () => {
  let accountId

  beforeEach(() => {
    accountId = randomUUID()
  })

  afterEach(async () => {
    await pool.query('DELETE FROM accounts WHERE id = ?', [accountId])
  })

  it('create applies', async () => {
    const result = await applyOp(pool, {
      entity: 'accounts',
      action: 'create',
      payload: { id: accountId, name: 'Ops Account' },
    })
    expect(result).toEqual({ id: accountId, status: 'applied' })
  })

  it('retrying the same create is idempotent (applied, not error)', async () => {
    const op = { entity: 'accounts', action: 'create', payload: { id: accountId, name: 'Ops Account' } }
    await applyOp(pool, op)
    const retry = await applyOp(pool, op)
    expect(retry.status).toBe('applied')
  })

  it('update on an unknown id returns error NOT_FOUND', async () => {
    const result = await applyOp(pool, {
      entity: 'accounts',
      action: 'update',
      payload: { id: randomUUID(), name: 'X' },
    })
    expect(result.status).toBe('error')
    expect(result.code).toBe('NOT_FOUND')
  })

  it('delete on an already-deleted/unknown id is idempotent (applied)', async () => {
    const result = await applyOp(pool, { entity: 'accounts', action: 'delete', payload: { id: randomUUID() } })
    expect(result.status).toBe('applied')
  })

  it('rejects an invalid account type instead of writing it (schema validation)', async () => {
    const result = await applyOp(pool, {
      entity: 'accounts',
      action: 'create',
      payload: { id: accountId, name: 'Bad', type: 'crypto' },
    })
    expect(result.status).toBe('error')
    expect(result.code).toBe('VALIDATION_ERROR')
    const written = await pool.query('SELECT id FROM accounts WHERE id = ?', [accountId])
    expect(written[0]).toHaveLength(0)
  })
})

describe('applyOp — simple-entity validation', () => {
  it('rejects a non-positive budget limit (schema validation)', async () => {
    const result = await applyOp(pool, {
      entity: 'budgets',
      action: 'create',
      payload: { id: randomUUID(), categoryId: randomUUID(), limitAmount: -500 },
    })
    expect(result.status).toBe('error')
    expect(result.code).toBe('VALIDATION_ERROR')
  })
})

describe('applyOp - recurring resume', () => {
  let accountId
  let categoryId
  let ruleId

  beforeEach(async () => {
    accountId = randomUUID()
    categoryId = randomUUID()
    ruleId = randomUUID()
    await accountsRepo.create(pool, { id: accountId, name: 'Recurring Sync Account' })
    await categoriesRepo.create(pool, { id: categoryId, name: `Recurring Sync Category ${categoryId}` })
  })

  afterEach(async () => {
    await pool.query('DELETE FROM recurring_runs WHERE rule_id = ?', [ruleId])
    await pool.query('DELETE FROM recurring_rules WHERE id = ?', [ruleId])
    await pool.query('DELETE FROM accounts WHERE id = ?', [accountId])
    await pool.query('DELETE FROM categories WHERE id = ?', [categoryId])
  })

  it('advances an overdue paused rule when sync resumes it', async () => {
    const today = todayInBangkok()
    await applyOp(pool, {
      entity: 'recurring',
      action: 'create',
      payload: {
        id: ruleId,
        type: 'expense',
        amount: 1000,
        categoryId,
        accountId,
        intervalUnit: 'day',
        intervalCount: 2,
        nextRunDate: addInterval(today, 'day', -3),
      },
    })
    await applyOp(pool, { entity: 'recurring', action: 'update', payload: { id: ruleId, active: false } })

    const result = await applyOp(pool, {
      entity: 'recurring',
      action: 'update',
      payload: { id: ruleId, active: true },
    })

    expect(result).toEqual({ id: ruleId, status: 'applied' })
    const updated = await recurringRepo.findById(pool, ruleId)
    expect(updated.active).toBe(1)
    expect(updated.next_run_date).toBe(addInterval(today, 'day', 1))
  })
})
