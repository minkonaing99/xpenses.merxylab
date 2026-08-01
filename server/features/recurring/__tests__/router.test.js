'use strict'

const { randomUUID } = require('crypto')
const express = require('express')
const request = require('supertest')
const { getPool } = require('../../../db/pool')
const accountsRepo = require('../../accounts/repo')
const categoriesRepo = require('../../categories/repo')
const { createRecurringRouter } = require('../router')
const { todayInBangkok } = require('../../../cron/dateUtil')
const errorHandler = require('../../../middleware/error')

const pool = getPool()

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/recurring', createRecurringRouter(pool))
  app.use(errorHandler)
  return app
}

afterAll(async () => {
  await pool.end()
})

describe('recurring router', () => {
  let app
  let accountId
  let categoryId
  let ruleId

  beforeEach(async () => {
    app = buildApp()
    accountId = randomUUID()
    categoryId = randomUUID()
    ruleId = randomUUID()
    await accountsRepo.create(pool, { id: accountId, name: 'Recurring Router Account' })
    await categoriesRepo.create(pool, { id: categoryId, name: `Recurring Router Category ${categoryId}` })
  })

  afterEach(async () => {
    await pool.query('DELETE FROM recurring_runs WHERE rule_id = ?', [ruleId])
    await pool.query('DELETE FROM recurring_rules WHERE id = ?', [ruleId])
    await pool.query('DELETE FROM accounts WHERE id = ?', [accountId])
    await pool.query('DELETE FROM categories WHERE id = ?', [categoryId])
  })

  const validRule = () => ({
    id: ruleId,
    type: 'expense',
    amount: 1500,
    note: 'Rent',
    categoryId,
    accountId,
    intervalUnit: 'month',
    intervalCount: 1,
    nextRunDate: '2026-08-01',
  })

  it('GET /upcoming projects an active rule due within the window', async () => {
    const today = todayInBangkok()
    await request(app).post('/api/recurring').send({ ...validRule(), nextRunDate: today })

    const res = await request(app).get('/api/recurring/upcoming').query({ days: 30 })
    expect(res.status).toBe(200)
    expect(res.body.data.some((u) => u.id === ruleId && u.date === today)).toBe(true)
  })

  it('POST creates a rule, GET / lists it', async () => {
    const createRes = await request(app).post('/api/recurring').send(validRule())
    expect(createRes.status).toBe(201)
    expect(createRes.body.data).toMatchObject({ amount: 1500, active: true })

    const listRes = await request(app).get('/api/recurring')
    expect(listRes.body.data.some((r) => r.id === ruleId)).toBe(true)
  })

  it('POST rejects an expense rule missing categoryId', async () => {
    const { categoryId: _drop, ...body } = validRule()
    const res = await request(app).post('/api/recurring').send(body)
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('POST rejects an invalid intervalUnit', async () => {
    const res = await request(app).post('/api/recurring').send({ ...validRule(), intervalUnit: 'fortnight' })
    expect(res.status).toBe(400)
  })

  it('PATCH pauses a rule via active=false, 404 for an unknown id', async () => {
    await request(app).post('/api/recurring').send(validRule())
    const patchRes = await request(app).patch(`/api/recurring/${ruleId}`).send({ active: false })
    expect(patchRes.status).toBe(200)
    expect(patchRes.body.data.active).toBe(false)

    const notFoundRes = await request(app).patch(`/api/recurring/${randomUUID()}`).send({ active: false })
    expect(notFoundRes.status).toBe(404)
  })

  it('DELETE soft-deletes a rule', async () => {
    await request(app).post('/api/recurring').send(validRule())
    const res = await request(app).delete(`/api/recurring/${ruleId}`)
    expect(res.status).toBe(200)

    const listRes = await request(app).get('/api/recurring')
    expect(listRes.body.data.some((r) => r.id === ruleId)).toBe(false)
  })
})
