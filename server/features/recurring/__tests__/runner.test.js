'use strict'

const { randomUUID } = require('crypto')
const { getPool } = require('../../../db/pool')
const accountsRepo = require('../../accounts/repo')
const categoriesRepo = require('../../categories/repo')
const repo = require('../repo')
const { runCronOnce, processRule } = require('../runner')

const pool = getPool()

afterAll(async () => {
  await pool.end()
})

describe('recurring runner', () => {
  let accountId
  let categoryId
  let ruleId

  beforeEach(async () => {
    accountId = randomUUID()
    categoryId = randomUUID()
    ruleId = randomUUID()
    await accountsRepo.create(pool, { id: accountId, name: 'Cron Test Account' })
    await categoriesRepo.create(pool, { id: categoryId, name: `Cron Test Category ${categoryId}` })
  })

  afterEach(async () => {
    const [runs] = await pool.query('SELECT transaction_id FROM recurring_runs WHERE rule_id = ?', [ruleId])
    for (const run of runs) {
      await pool.query('DELETE FROM transactions WHERE id = ?', [run.transaction_id])
    }
    await pool.query('DELETE FROM recurring_runs WHERE rule_id = ?', [ruleId])
    await pool.query('DELETE FROM recurring_rules WHERE id = ?', [ruleId])
    await pool.query('DELETE FROM accounts WHERE id = ?', [accountId])
    await pool.query('DELETE FROM categories WHERE id = ?', [categoryId])
  })

  async function makeRule(overrides = {}) {
    await repo.create(pool, {
      id: ruleId,
      type: 'expense',
      amount: 1500,
      note: 'Rent',
      categoryId,
      accountId,
      intervalUnit: 'month',
      intervalCount: 1,
      nextRunDate: '2026-07-01',
      ...overrides,
    })
  }

  it('processRule inserts a transaction, a recurring_runs guard row, and advances next_run_date', async () => {
    await makeRule()
    const rule = await repo.findById(pool, ruleId)

    const result = await processRule(pool, rule, '2026-07-10')
    expect(result).toEqual({ ruleId, runsPlanned: 1, runsInserted: 1 })

    const [runs] = await pool.query('SELECT * FROM recurring_runs WHERE rule_id = ? AND run_date = ?', [
      ruleId,
      '2026-07-01',
    ])
    expect(runs).toHaveLength(1)

    const [txns] = await pool.query('SELECT * FROM transactions WHERE id = ?', [runs[0].transaction_id])
    expect(txns[0]).toMatchObject({ amount: 1500, txn_date: '2026-07-01' })

    const updatedRule = await repo.findById(pool, ruleId)
    expect(updatedRule.next_run_date).toBe('2026-08-01')
  })

  it('is idempotent — running the same rule twice for the same day does not double-insert', async () => {
    await makeRule()
    const rule = await repo.findById(pool, ruleId)

    await processRule(pool, rule, '2026-07-10')
    // Re-fetch as findDue would (same next_run_date the first run started from,
    // simulating the cron firing twice before the first run's advance is visible)
    const second = await processRule(pool, rule, '2026-07-10')

    // Second call replays run_date 2026-07-01, already guarded — 0 new inserts.
    expect(second.runsInserted).toBe(0)

    const [txns] = await pool.query(
      `SELECT t.* FROM transactions t
       JOIN recurring_runs r ON r.transaction_id = t.id
       WHERE r.rule_id = ?`,
      [ruleId],
    )
    expect(txns).toHaveLength(1)
  })

  it('catches up multiple missed monthly runs in one pass', async () => {
    await makeRule({ nextRunDate: '2026-05-01' })
    const rule = await repo.findById(pool, ruleId)

    const result = await processRule(pool, rule, '2026-07-10')
    expect(result.runsPlanned).toBe(3) // May, June, July
    expect(result.runsInserted).toBe(3)

    const updatedRule = await repo.findById(pool, ruleId)
    expect(updatedRule.next_run_date).toBe('2026-08-01')
  })

  it('does nothing for a rule that is not yet due', async () => {
    await makeRule({ nextRunDate: '2026-09-01' })
    const rule = await repo.findById(pool, ruleId)

    const result = await processRule(pool, rule, '2026-07-10')
    expect(result).toEqual({ ruleId, runsPlanned: 0, runsInserted: 0 })
  })

  it('runCronOnce processes all due rules and skips paused ones', async () => {
    await makeRule({ nextRunDate: '2026-07-01' })
    await repo.update(pool, ruleId, { active: false })

    const results = await runCronOnce(pool, '2026-07-10')
    expect(results.find((r) => r.ruleId === ruleId)).toBeUndefined()
  })
})
