'use strict'

const { randomUUID } = require('crypto')
const express = require('express')
const request = require('supertest')
const { getPool } = require('../../../db/pool')
const { createAccountsRouter } = require('../router')
const errorHandler = require('../../../middleware/error')

const pool = getPool()

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/accounts', createAccountsRouter(pool))
  app.use(errorHandler)
  return app
}

afterAll(async () => {
  await pool.end()
})

describe('accounts router', () => {
  let app
  let accountId

  beforeEach(() => {
    app = buildApp()
    accountId = randomUUID()
  })

  afterEach(async () => {
    await pool.query('DELETE FROM transactions WHERE account_id = ? OR from_account_id = ? OR to_account_id = ?', [
      accountId,
      accountId,
      accountId,
    ])
    await pool.query('DELETE FROM accounts WHERE id = ?', [accountId])
  })

  it('POST creates an account, GET / lists it with a computed balance', async () => {
    const createRes = await request(app)
      .post('/api/accounts')
      .send({ id: accountId, name: 'Test Wallet', type: 'cash', startingBalance: 5000 })
    expect(createRes.status).toBe(201)

    const listRes = await request(app).get('/api/accounts')
    expect(listRes.status).toBe(200)
    const created = listRes.body.data.find((a) => a.id === accountId)
    expect(created).toMatchObject({ name: 'Test Wallet', startingBalance: 5000, balance: 5000 })
  })

  it('POST rejects a missing name with 400 VALIDATION_ERROR', async () => {
    const res = await request(app).post('/api/accounts').send({ id: accountId })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('POST returns 409 CONFLICT for a duplicate id', async () => {
    await request(app).post('/api/accounts').send({ id: accountId, name: 'First' })
    const res = await request(app).post('/api/accounts').send({ id: accountId, name: 'Second' })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('CONFLICT')
  })

  it('PATCH updates a field, 404 for an unknown id', async () => {
    await request(app).post('/api/accounts').send({ id: accountId, name: 'Original' })
    const patchRes = await request(app).patch(`/api/accounts/${accountId}`).send({ name: 'Renamed' })
    expect(patchRes.status).toBe(200)
    expect(patchRes.body.data.name).toBe('Renamed')

    const notFoundRes = await request(app).patch(`/api/accounts/${randomUUID()}`).send({ name: 'X' })
    expect(notFoundRes.status).toBe(404)
  })

  it('DELETE soft-deletes an unreferenced account', async () => {
    await request(app).post('/api/accounts').send({ id: accountId, name: 'To Delete' })
    const res = await request(app).delete(`/api/accounts/${accountId}`)
    expect(res.status).toBe(200)

    const listRes = await request(app).get('/api/accounts')
    expect(listRes.body.data.find((a) => a.id === accountId)).toBeUndefined()
  })

  it('DELETE returns 409 CONFLICT when the account is referenced by a transaction', async () => {
    await request(app).post('/api/accounts').send({ id: accountId, name: 'Referenced' })
    await pool.query(
      `INSERT INTO transactions (id, type, amount, account_id, txn_date, updated_at)
       VALUES (?, 'expense', 100, ?, CURDATE(), NOW())`,
      [randomUUID(), accountId],
    )

    const res = await request(app).delete(`/api/accounts/${accountId}`)
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('CONFLICT')
  })
})
