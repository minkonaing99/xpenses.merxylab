'use strict'

const { randomUUID } = require('crypto')
const express = require('express')
const request = require('supertest')
const { getPool } = require('../../../db/pool')
const accountsRepo = require('../../accounts/repo')
const categoriesRepo = require('../../categories/repo')
const txnRepo = require('../../transactions/repo')
const { createInsightsRouter } = require('../router')
const errorHandler = require('../../../middleware/error')

const pool = getPool()

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/insights', createInsightsRouter(pool))
  app.use(errorHandler)
  return app
}

afterAll(async () => {
  await pool.end()
})

describe('insights router', () => {
  let app
  let accountId
  let categoryId
  let budgetId
  let txnIds

  beforeEach(async () => {
    app = buildApp()
    accountId = randomUUID()
    categoryId = randomUUID()
    txnIds = []
    await accountsRepo.create(pool, { id: accountId, name: 'Insights Router Account' })
    await categoriesRepo.create(pool, { id: categoryId, name: `Insights Router Category ${categoryId}` })
  })

  afterEach(async () => {
    if (budgetId) await pool.query('DELETE FROM budgets WHERE id = ?', [budgetId])
    budgetId = undefined
    for (const id of txnIds) {
      await pool.query('DELETE FROM transactions WHERE id = ?', [id])
    }
    await pool.query('DELETE FROM accounts WHERE id = ?', [accountId])
    await pool.query('DELETE FROM categories WHERE id = ?', [categoryId])
  })

  async function makeTxn(type, amount, txnDate, extra = {}) {
    const id = randomUUID()
    txnIds.push(id)
    await txnRepo.create(pool, {
      id,
      type,
      amount,
      txnDate,
      updatedAt: '2034-01-10 09:00:00',
      ...(type === 'expense' ? { categoryId, accountId } : { accountId }),
      ...extra,
    })
    return id
  }

  describe('GET /forecast', () => {
    it('requires a month param', async () => {
      const res = await request(app).get('/api/insights/forecast')
      expect(res.status).toBe(400)
    })

    it('projects month-end from discretionary burn at a fixed asOf date', async () => {
      await makeTxn('income', 200000, '2034-02-01')
      await makeTxn('expense', 30000, '2034-02-05') // discretionary

      const res = await request(app)
        .get('/api/insights/forecast')
        .query({ month: '2034-02', asOf: '2034-02-10' })
      expect(res.status).toBe(200)
      expect(res.body.data).toMatchObject({
        month: '2034-02',
        daysInMonth: 28,
        daysElapsed: 10,
        paidIncome: 200000,
        paidExpense: 30000,
      })
      // 30000 / 10 days = 3000/day * 18 remaining = 54000 -> projected 84000
      expect(res.body.data.projectedExpense).toBe(84000)
      expect(res.body.data.projectedNet).toBe(200000 - 84000)
    })
  })

  describe('GET /anomalies', () => {
    it('flags a budget on pace to overrun early in the month', async () => {
      budgetId = randomUUID()
      await pool.query('INSERT INTO budgets (id, category_id, limit_amount) VALUES (?, ?, ?)', [
        budgetId,
        categoryId,
        100000,
      ])
      await makeTxn('expense', 85000, '2034-03-03')

      const res = await request(app)
        .get('/api/insights/anomalies')
        .query({ month: '2034-03', asOf: '2034-03-06' })
      expect(res.status).toBe(200)
      const burn = res.body.data.find((a) => a.type === 'budget_burn' && a.categoryId === categoryId)
      expect(burn).toBeTruthy()
    })

  })

  describe('GET /comparisons', () => {
    it('returns per-category current vs last vs trailing-average deltas', async () => {
      await makeTxn('expense', 10000, '2034-06-05') // current
      await makeTxn('expense', 4000, '2034-05-05') // last month

      const res = await request(app).get('/api/insights/comparisons').query({ month: '2034-06' })
      expect(res.status).toBe(200)
      const row = res.body.data.find((r) => r.categoryId === categoryId)
      expect(row).toMatchObject({ current: 10000, last: 4000 })
      expect(row.vsLast).toBe(6000)
    })

    it('requires a month param', async () => {
      const res = await request(app).get('/api/insights/comparisons')
      expect(res.status).toBe(400)
    })
  })
})
