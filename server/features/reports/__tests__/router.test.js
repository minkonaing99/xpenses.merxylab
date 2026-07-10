'use strict'

const { randomUUID } = require('crypto')
const express = require('express')
const request = require('supertest')
const { getPool } = require('../../../db/pool')
const accountsRepo = require('../../accounts/repo')
const categoriesRepo = require('../../categories/repo')
const txnRepo = require('../../transactions/repo')
const { createReportsRouter } = require('../router')
const errorHandler = require('../../../middleware/error')

const pool = getPool()

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/reports', createReportsRouter(pool))
  app.use(errorHandler)
  return app
}

afterAll(async () => {
  await pool.end()
})

describe('reports router', () => {
  let app
  let accountId
  let categoryId
  let txnIds

  beforeEach(async () => {
    app = buildApp()
    accountId = randomUUID()
    categoryId = randomUUID()
    txnIds = []
    await accountsRepo.create(pool, { id: accountId, name: 'Reports Router Account' })
    await categoriesRepo.create(pool, { id: categoryId, name: `Reports Router Category ${categoryId}` })
  })

  afterEach(async () => {
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
      updatedAt: '2026-07-10 09:00:00',
      ...(type === 'expense' ? { categoryId, accountId } : { accountId }),
      ...extra,
    })
  }

  it('GET /category-spend requires a month param', async () => {
    const res = await request(app).get('/api/reports/category-spend')
    expect(res.status).toBe(400)
  })

  it('GET /category-spend returns categoryId/name/total for the month', async () => {
    await makeTxn('expense', 6420, '2026-07-05')

    const res = await request(app).get('/api/reports/category-spend').query({ month: '2026-07' })
    expect(res.status).toBe(200)
    const row = res.body.data.find((r) => r.categoryId === categoryId)
    expect(row).toMatchObject({ total: 6420 })
    expect(row.name).toBeTruthy()
  })

  it('GET /summary returns account balances and net total for the month', async () => {
    // monthIncome/monthExpense are global aggregates — use a collision-free
    // month (see the equivalent note in reports/__tests__/repo.test.js).
    await makeTxn('income', 50000, '2031-11-01')
    await makeTxn('expense', 32000, '2031-11-05')

    const res = await request(app).get('/api/reports/summary').query({ month: '2031-11' })
    expect(res.status).toBe(200)
    expect(res.body.data.accounts.some((a) => a.id === accountId)).toBe(true)
    expect(res.body.data).toMatchObject({ monthIncome: 50000, monthExpense: 32000, monthNet: 18000 })
  })

  it('GET /summary requires a month param', async () => {
    const res = await request(app).get('/api/reports/summary')
    expect(res.status).toBe(400)
  })
})
