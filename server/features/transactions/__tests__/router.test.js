'use strict'

const { randomUUID } = require('crypto')
const express = require('express')
const request = require('supertest')
const { getPool } = require('../../../db/pool')
const accountsRepo = require('../../accounts/repo')
const categoriesRepo = require('../../categories/repo')
const { createTransactionsRouter } = require('../router')
const errorHandler = require('../../../middleware/error')

const pool = getPool()

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/transactions', createTransactionsRouter(pool))
  app.use(errorHandler)
  return app
}

afterAll(async () => {
  await pool.end()
})

describe('transactions router', () => {
  let app
  let accountId
  let categoryId
  let txnId

  beforeEach(async () => {
    app = buildApp()
    accountId = randomUUID()
    categoryId = randomUUID()
    txnId = randomUUID()
    await accountsRepo.create(pool, { id: accountId, name: 'Router Test Account' })
    await categoriesRepo.create(pool, { id: categoryId, name: `Router Test Category ${categoryId}` })
  })

  afterEach(async () => {
    await pool.query('DELETE FROM transactions WHERE id = ?', [txnId])
    await pool.query('DELETE FROM accounts WHERE id = ?', [accountId])
    await pool.query('DELETE FROM categories WHERE id = ?', [categoryId])
  })

  const validExpense = () => ({
    id: txnId,
    type: 'expense',
    amount: 8600,
    note: 'groceries',
    categoryId,
    accountId,
    txnDate: '2026-07-10',
    updatedAt: '2026-07-10T09:00:00.000Z',
  })

  it('POST creates a transaction, GET /:id retrieves it', async () => {
    const createRes = await request(app).post('/api/transactions').send(validExpense())
    expect(createRes.status).toBe(201)

    const getRes = await request(app).get(`/api/transactions/${txnId}`)
    expect(getRes.status).toBe(200)
    expect(getRes.body.data).toMatchObject({ amount: 8600, type: 'expense' })
  })

  it('POST rejects amount <= 0 with 400 VALIDATION_ERROR', async () => {
    const res = await request(app).post('/api/transactions').send({ ...validExpense(), amount: 0 })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('POST rejects an expense missing categoryId with 400 VALIDATION_ERROR', async () => {
    const { categoryId: _drop, ...body } = validExpense()
    const res = await request(app).post('/api/transactions').send(body)
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('POST rejects a transfer with equal fromAccountId/toAccountId', async () => {
    const res = await request(app).post('/api/transactions').send({
      id: txnId,
      type: 'transfer',
      amount: 500,
      fromAccountId: accountId,
      toAccountId: accountId,
      txnDate: '2026-07-10',
      updatedAt: '2026-07-10T09:00:00.000Z',
    })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('POST is idempotent — replaying the exact same txn applies (200), not a conflict', async () => {
    const first = await request(app).post('/api/transactions').send(validExpense())
    expect(first.status).toBe(201)

    const replay = await request(app).post('/api/transactions').send(validExpense())
    expect(replay.status).toBe(200)
    expect(replay.body.meta.syncStatus).toBe('applied')
  })

  it('POST with a newer updatedAt applies as an edit (200, LWW winner)', async () => {
    await request(app).post('/api/transactions').send(validExpense())
    const res = await request(app)
      .post('/api/transactions')
      .send({ ...validExpense(), note: 'edited', updatedAt: '2026-07-10T10:00:00.000Z' })

    expect(res.status).toBe(200)
    expect(res.body.data.note).toBe('edited')
    expect(res.body.meta.syncStatus).toBe('applied')
  })

  it('POST with a stale (older) updatedAt is skipped, returning the current server row', async () => {
    await request(app)
      .post('/api/transactions')
      .send({ ...validExpense(), note: 'winner', updatedAt: '2026-07-10T10:00:00.000Z' })

    const res = await request(app)
      .post('/api/transactions')
      .send({ ...validExpense(), note: 'stale write', updatedAt: '2026-07-10T09:00:00.000Z' })

    expect(res.status).toBe(200)
    expect(res.body.data.note).toBe('winner')
    expect(res.body.meta.syncStatus).toBe('skipped')
  })

  it('GET / filters by type and month', async () => {
    await request(app).post('/api/transactions').send(validExpense())

    const res = await request(app).get('/api/transactions').query({ type: 'expense', month: '2026-07', accountId })
    expect(res.status).toBe(200)
    expect(res.body.data.some((t) => t.id === txnId)).toBe(true)
    expect(res.body.meta).toHaveProperty('nextCursor')
  })

  it('PATCH updates a field, 404 for an unknown id', async () => {
    await request(app).post('/api/transactions').send(validExpense())
    const patchRes = await request(app)
      .patch(`/api/transactions/${txnId}`)
      .send({ note: 'updated note', updatedAt: '2026-07-10T10:00:00.000Z' })
    expect(patchRes.status).toBe(200)
    expect(patchRes.body.data.note).toBe('updated note')

    const notFoundRes = await request(app)
      .patch(`/api/transactions/${randomUUID()}`)
      .send({ note: 'x', updatedAt: '2026-07-10T10:00:00.000Z' })
    expect(notFoundRes.status).toBe(404)
  })

  it('PATCH with a stale updatedAt is skipped, current data unchanged', async () => {
    await request(app)
      .post('/api/transactions')
      .send({ ...validExpense(), updatedAt: '2026-07-10T10:00:00.000Z' })

    const res = await request(app)
      .patch(`/api/transactions/${txnId}`)
      .send({ note: 'stale patch', updatedAt: '2026-07-10T09:00:00.000Z' })

    expect(res.status).toBe(200)
    expect(res.body.data.note).toBe('groceries')
    expect(res.body.meta.syncStatus).toBe('skipped')
  })

  it('DELETE soft-deletes with a required updatedAt', async () => {
    await request(app).post('/api/transactions').send(validExpense())
    const res = await request(app).delete(`/api/transactions/${txnId}`).send({ updatedAt: '2026-07-10T11:00:00.000Z' })
    expect(res.status).toBe(200)

    const getRes = await request(app).get(`/api/transactions/${txnId}`)
    expect(getRes.status).toBe(404)
  })

  it('DELETE with a stale updatedAt is skipped, the row survives', async () => {
    await request(app)
      .post('/api/transactions')
      .send({ ...validExpense(), updatedAt: '2026-07-10T12:00:00.000Z' })

    const res = await request(app)
      .delete(`/api/transactions/${txnId}`)
      .send({ updatedAt: '2026-07-10T09:00:00.000Z' })

    expect(res.status).toBe(200)
    expect(res.body.meta.syncStatus).toBe('skipped')

    const getRes = await request(app).get(`/api/transactions/${txnId}`)
    expect(getRes.status).toBe(200)
  })
})
