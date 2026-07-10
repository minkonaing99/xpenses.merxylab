'use strict'

const { randomUUID } = require('crypto')
const { getPool } = require('../../../db/pool')
const accountsRepo = require('../../accounts/repo')
const categoriesRepo = require('../../categories/repo')
const repo = require('../repo')

const pool = getPool()

afterAll(async () => {
  await pool.end()
})

describe('recurring repo', () => {
  let accountId
  let categoryId
  let ruleId

  beforeEach(async () => {
    accountId = randomUUID()
    categoryId = randomUUID()
    ruleId = randomUUID()
    await accountsRepo.create(pool, { id: accountId, name: 'Recurring Test Account' })
    await categoriesRepo.create(pool, { id: categoryId, name: `Recurring Test Category ${categoryId}` })
  })

  afterEach(async () => {
    await pool.query('DELETE FROM recurring_runs WHERE rule_id = ?', [ruleId])
    await pool.query('DELETE FROM recurring_rules WHERE id = ?', [ruleId])
    await pool.query('DELETE FROM accounts WHERE id = ?', [accountId])
    await pool.query('DELETE FROM categories WHERE id = ?', [categoryId])
  })

  function baseRule(overrides = {}) {
    return {
      id: ruleId,
      type: 'expense',
      amount: 1500,
      note: 'Rent',
      categoryId,
      accountId,
      fromAccountId: null,
      toAccountId: null,
      intervalUnit: 'month',
      intervalCount: 1,
      nextRunDate: '2026-08-01',
      ...overrides,
    }
  }

  it('creates and finds a rule by id, active defaults to true', async () => {
    await repo.create(pool, baseRule())
    const found = await repo.findById(pool, ruleId)
    expect(found).toMatchObject({ id: ruleId, amount: 1500, interval_unit: 'month', active: 1 })
  })

  it('returns null for a non-existent id', async () => {
    expect(await repo.findById(pool, randomUUID())).toBeNull()
  })

  it('findAll includes the created rule', async () => {
    await repo.create(pool, baseRule())
    const rows = await repo.findAll(pool)
    expect(rows.some((r) => r.id === ruleId)).toBe(true)
  })

  it('updates only the given fields, e.g. pausing via active=false', async () => {
    await repo.create(pool, baseRule())
    await repo.update(pool, ruleId, { active: false })
    const found = await repo.findById(pool, ruleId)
    expect(found.active).toBe(0)
  })

  it('soft-deletes, excluding it from findById and findAll', async () => {
    await repo.create(pool, baseRule())
    await repo.softDelete(pool, ruleId)
    expect(await repo.findById(pool, ruleId)).toBeNull()
    const rows = await repo.findAll(pool)
    expect(rows.some((r) => r.id === ruleId)).toBe(false)
  })

  it('findDue finds active rules with next_run_date <= the given date', async () => {
    await repo.create(pool, baseRule({ nextRunDate: '2026-07-01' }))
    const due = await repo.findDue(pool, '2026-07-10')
    expect(due.some((r) => r.id === ruleId)).toBe(true)
  })

  it('findDue excludes rules with a future next_run_date', async () => {
    await repo.create(pool, baseRule({ nextRunDate: '2026-09-01' }))
    const due = await repo.findDue(pool, '2026-07-10')
    expect(due.some((r) => r.id === ruleId)).toBe(false)
  })

  it('findDue excludes paused (active=false) rules', async () => {
    await repo.create(pool, baseRule({ nextRunDate: '2026-07-01' }))
    await repo.update(pool, ruleId, { active: false })
    const due = await repo.findDue(pool, '2026-07-10')
    expect(due.some((r) => r.id === ruleId)).toBe(false)
  })

  it('findChangedSince includes rows updated after the given timestamp', async () => {
    await repo.create(pool, baseRule())
    const rows = await repo.findChangedSince(pool, '2000-01-01 00:00:00')
    expect(rows.some((r) => r.id === ruleId)).toBe(true)
  })
})
