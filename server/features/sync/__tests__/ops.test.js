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

  it('update on an unknown id returns error NOT_FOUND instead of creating it', async () => {
    const result = await applyOp(pool, {
      entity: 'transactions',
      action: 'update',
      payload: txnPayload(),
    })
    expect(result).toEqual({ id: txnId, status: 'error', code: 'NOT_FOUND' })
    const [rows] = await pool.query('SELECT id FROM transactions WHERE id = ?', [txnId])
    expect(rows).toHaveLength(0)
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

  it('rejects a non-positive transaction amount', async () => {
    const result = await applyOp(pool, {
      entity: 'transactions',
      action: 'create',
      payload: txnPayload({ amount: -1 }),
    })
    expect(result).toEqual({ id: txnId, status: 'error', code: 'VALIDATION_ERROR' })
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
  let txnId

  beforeEach(() => {
    accountId = randomUUID()
    txnId = randomUUID()
  })

  afterEach(async () => {
    await pool.query('DELETE FROM transactions WHERE id = ?', [txnId])
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

  it('rejects a malformed entity id', async () => {
    const result = await applyOp(pool, {
      entity: 'accounts',
      action: 'delete',
      payload: { id: 'bad-id' },
    })
    expect(result).toEqual({ id: 'bad-id', status: 'error', code: 'VALIDATION_ERROR' })
  })

  it('rejects deleting an account referenced by a transaction', async () => {
    await accountsRepo.create(pool, { id: accountId, name: 'Referenced Sync Account' })
    await pool.query(
      `INSERT INTO transactions (id, type, amount, account_id, txn_date, updated_at)
       VALUES (?, 'income', 100, ?, '2026-07-10', '2026-07-10 09:00:00')`,
      [txnId, accountId],
    )

    const result = await applyOp(pool, {
      entity: 'accounts',
      action: 'delete',
      payload: { id: accountId },
    })

    expect(result).toEqual({ id: accountId, status: 'error', code: 'CONFLICT' })
    expect(await accountsRepo.findById(pool, accountId)).not.toBeNull()
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

describe('applyOp - budget rules', () => {
  let categoryId
  let budgetIds

  beforeEach(async () => {
    categoryId = randomUUID()
    budgetIds = []
    await categoriesRepo.create(pool, { id: categoryId, name: `Budget Sync Category ${categoryId}` })
  })

  afterEach(async () => {
    if (budgetIds.length > 0) {
      await pool.query('DELETE FROM budgets WHERE id IN (?)', [budgetIds])
    }
    await pool.query('DELETE FROM categories WHERE id = ?', [categoryId])
  })

  it('rejects a second active budget for the same category', async () => {
    const firstId = randomUUID()
    const secondId = randomUUID()
    budgetIds = [firstId, secondId]
    await applyOp(pool, {
      entity: 'budgets',
      action: 'create',
      payload: { id: firstId, categoryId, limitAmount: 1000 },
    })

    const result = await applyOp(pool, {
      entity: 'budgets',
      action: 'create',
      payload: { id: secondId, categoryId, limitAmount: 2000 },
    })

    expect(result).toEqual({ id: secondId, status: 'error', code: 'CONFLICT' })
  })

  it('keeps an old create replay idempotent after its category is reused', async () => {
    const firstId = randomUUID()
    const secondId = randomUUID()
    const original = {
      entity: 'budgets',
      action: 'create',
      payload: { id: firstId, categoryId, limitAmount: 1000 },
    }
    budgetIds = [firstId, secondId]
    await applyOp(pool, original)
    await applyOp(pool, { entity: 'budgets', action: 'delete', payload: { id: firstId } })
    await applyOp(pool, {
      entity: 'budgets',
      action: 'create',
      payload: { id: secondId, categoryId, limitAmount: 2000 },
    })

    expect(await applyOp(pool, original)).toEqual({ id: firstId, status: 'applied' })
  })
})

describe('applyOp - category rules', () => {
  let categoryIds
  let accountIds
  let transactionIds

  beforeEach(() => {
    categoryIds = []
    accountIds = []
    transactionIds = []
  })

  afterEach(async () => {
    if (transactionIds.length > 0) {
      await pool.query('DELETE FROM transactions WHERE id IN (?)', [transactionIds])
    }
    if (categoryIds.length > 0) {
      await pool.query('DELETE FROM categories WHERE id IN (?)', [categoryIds])
    }
    if (accountIds.length > 0) {
      await pool.query('DELETE FROM accounts WHERE id IN (?)', [accountIds])
    }
  })

  it('rejects a duplicate active category name', async () => {
    const firstId = randomUUID()
    const secondId = randomUUID()
    categoryIds = [firstId, secondId]
    await applyOp(pool, {
      entity: 'categories',
      action: 'create',
      payload: { id: firstId, name: 'Duplicate Sync Category' },
    })

    const result = await applyOp(pool, {
      entity: 'categories',
      action: 'create',
      payload: { id: secondId, name: 'Duplicate Sync Category' },
    })

    expect(result).toEqual({ id: secondId, status: 'error', code: 'CONFLICT' })
    expect(await categoriesRepo.findById(pool, secondId)).toBeNull()
  })

  it('keeps an old create replay idempotent after its name is reused', async () => {
    const firstId = randomUUID()
    const secondId = randomUUID()
    const original = {
      entity: 'categories',
      action: 'create',
      payload: { id: firstId, name: 'Reused Sync Category' },
    }
    categoryIds = [firstId, secondId]
    await applyOp(pool, original)
    await applyOp(pool, { entity: 'categories', action: 'delete', payload: { id: firstId } })
    await applyOp(pool, {
      entity: 'categories',
      action: 'create',
      payload: { id: secondId, name: 'Reused Sync Category' },
    })

    expect(await applyOp(pool, original)).toEqual({ id: firstId, status: 'applied' })
  })

  it('rejects deleting a category referenced by a transaction', async () => {
    const categoryId = randomUUID()
    const accountId = randomUUID()
    const transactionId = randomUUID()
    categoryIds = [categoryId]
    accountIds = [accountId]
    transactionIds = [transactionId]
    await categoriesRepo.create(pool, { id: categoryId, name: 'Referenced Sync Category' })
    await accountsRepo.create(pool, { id: accountId, name: 'Category Guard Account' })
    await pool.query(
      `INSERT INTO transactions (id, type, amount, category_id, account_id, txn_date, updated_at)
       VALUES (?, 'expense', 100, ?, ?, '2026-07-10', '2026-07-10 09:00:00')`,
      [transactionId, categoryId, accountId],
    )

    const result = await applyOp(pool, {
      entity: 'categories',
      action: 'delete',
      payload: { id: categoryId },
    })

    expect(result).toEqual({ id: categoryId, status: 'error', code: 'CONFLICT' })
    expect(await categoriesRepo.findById(pool, categoryId)).not.toBeNull()
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
