'use strict'

const { randomUUID } = require('crypto')
const express = require('express')
const request = require('supertest')
const { getPool } = require('../../../db/pool')
const accountsRepo = require('../../accounts/repo')
const categoriesRepo = require('../../categories/repo')
const recurringRepo = require('../../recurring/repo')
const { createCronRouter } = require('../router')
const errorHandler = require('../../../middleware/error')

const pool = getPool()
const SHARED_SECRET = 'test-cron-shared-secret'

function daysAgo(n) {
  const d = new Date(Date.now() - n * 24 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 10)
}

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/cron', createCronRouter(pool, SHARED_SECRET))
  app.use(errorHandler)
  return app
}

afterAll(async () => {
  await pool.end()
})

describe('POST /api/cron/run', () => {
  let app
  let accountId
  let categoryId
  let ruleId

  beforeEach(async () => {
    app = buildApp()
    accountId = randomUUID()
    categoryId = randomUUID()
    ruleId = randomUUID()
    await accountsRepo.create(pool, { id: accountId, name: 'Cron Route Account' })
    await categoriesRepo.create(pool, { id: categoryId, name: `Cron Route Category ${categoryId}` })
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

  it('rejects a missing shared secret', async () => {
    const res = await request(app).post('/api/cron/run')
    expect(res.status).toBe(401)
  })

  it('rejects a wrong shared secret', async () => {
    const res = await request(app).post('/api/cron/run').set('X-Cron-Secret', 'wrong-secret')
    expect(res.status).toBe(401)
  })

  it('runs due recurring rules with the correct shared secret', async () => {
    await recurringRepo.create(pool, {
      id: ruleId,
      type: 'expense',
      amount: 1500,
      categoryId,
      accountId,
      intervalUnit: 'month',
      intervalCount: 1,
      nextRunDate: daysAgo(20), // overdue by 20 days — one monthly run due
    })

    const res = await request(app).post('/api/cron/run').set('X-Cron-Secret', SHARED_SECRET)
    expect(res.status).toBe(200)
    const ruleResult = res.body.data.results.find((r) => r.ruleId === ruleId)
    expect(ruleResult.runsInserted).toBeGreaterThan(0)
  })
})
