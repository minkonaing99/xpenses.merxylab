'use strict'

const { randomUUID } = require('crypto')
const express = require('express')
const request = require('supertest')
const { getPool } = require('../../../db/pool')
const categoriesRepo = require('../../categories/repo')
const { createBudgetsRouter } = require('../router')
const errorHandler = require('../../../middleware/error')

const pool = getPool()

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/budgets', createBudgetsRouter(pool))
  app.use(errorHandler)
  return app
}

afterAll(async () => {
  await pool.end()
})

describe('budgets router', () => {
  let app
  let categoryId
  let budgetId

  beforeEach(async () => {
    app = buildApp()
    categoryId = randomUUID()
    budgetId = randomUUID()
    await categoriesRepo.create(pool, { id: categoryId, name: `Budget Router Category ${categoryId}` })
  })

  afterEach(async () => {
    await pool.query('DELETE FROM budgets WHERE id = ?', [budgetId])
    await pool.query('DELETE FROM categories WHERE id = ?', [categoryId])
  })

  it('POST creates a budget, GET / lists it with spent + over computed', async () => {
    const createRes = await request(app)
      .post('/api/budgets')
      .send({ id: budgetId, categoryId, limitAmount: 6000 })
    expect(createRes.status).toBe(201)
    expect(createRes.body.data).toMatchObject({ limitAmount: 6000, spent: 0, over: false })

    const listRes = await request(app).get('/api/budgets').query({ month: '2026-07' })
    expect(listRes.status).toBe(200)
    expect(listRes.body.data.find((b) => b.id === budgetId)).toMatchObject({ limitAmount: 6000 })
  })

  it('GET / requires a month query param', async () => {
    const res = await request(app).get('/api/budgets')
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('POST rejects a negative limitAmount', async () => {
    const res = await request(app).post('/api/budgets').send({ id: budgetId, categoryId, limitAmount: -100 })
    expect(res.status).toBe(400)
  })

  it('POST returns 409 CONFLICT for a second budget on the same category', async () => {
    await request(app).post('/api/budgets').send({ id: budgetId, categoryId, limitAmount: 6000 })
    const res = await request(app).post('/api/budgets').send({ id: randomUUID(), categoryId, limitAmount: 3000 })
    expect(res.status).toBe(409)
  })

  it('PATCH updates limitAmount, 404 for an unknown id', async () => {
    await request(app).post('/api/budgets').send({ id: budgetId, categoryId, limitAmount: 6000 })
    const patchRes = await request(app).patch(`/api/budgets/${budgetId}`).send({ limitAmount: 8000 })
    expect(patchRes.status).toBe(200)
    expect(patchRes.body.data.limitAmount).toBe(8000)

    const notFoundRes = await request(app).patch(`/api/budgets/${randomUUID()}`).send({ limitAmount: 1 })
    expect(notFoundRes.status).toBe(404)
  })

  it('DELETE soft-deletes, and the category becomes available for a new budget', async () => {
    await request(app).post('/api/budgets').send({ id: budgetId, categoryId, limitAmount: 6000 })
    const res = await request(app).delete(`/api/budgets/${budgetId}`)
    expect(res.status).toBe(200)

    const secondId = randomUUID()
    const recreateRes = await request(app).post('/api/budgets').send({ id: secondId, categoryId, limitAmount: 3000 })
    expect(recreateRes.status).toBe(201)
    await pool.query('DELETE FROM budgets WHERE id = ?', [secondId])
  })
})
