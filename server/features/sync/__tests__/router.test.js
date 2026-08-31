'use strict'

const { randomUUID } = require('crypto')
const express = require('express')
const request = require('supertest')
const { getPool } = require('../../../db/pool')
const accountsRepo = require('../../accounts/repo')
const categoriesRepo = require('../../categories/repo')
const { createSyncRouter } = require('../router')
const errorHandler = require('../../../middleware/error')

const pool = getPool()

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/sync', createSyncRouter(pool))
  app.use(errorHandler)
  return app
}

afterAll(async () => {
  await pool.end()
})

describe('GET /api/sync', () => {
  let app
  let accountId
  let otherAccountId

  beforeEach(() => {
    app = buildApp()
    accountId = randomUUID()
    otherAccountId = randomUUID()
  })

  afterEach(async () => {
    await pool.query(
      'DELETE FROM transactions WHERE account_id IN (?, ?) OR from_account_id IN (?, ?) OR to_account_id IN (?, ?)',
      [accountId, otherAccountId, accountId, otherAccountId, accountId, otherAccountId],
    )
    await pool.query('DELETE FROM accounts WHERE id IN (?, ?)', [accountId, otherAccountId])
  })

  it('requires a valid since query param', async () => {
    const res = await request(app).get('/api/sync').query({ since: 'not-a-date' })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns rows changed since the given timestamp across entities', async () => {
    await accountsRepo.create(pool, { id: accountId, name: 'Sync Test Account' })

    const res = await request(app).get('/api/sync').query({ since: '2000-01-01T00:00:00.000Z' })
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveProperty('accounts')
    expect(res.body.data).toHaveProperty('categories')
    expect(res.body.data).toHaveProperty('transactions')
    expect(res.body.data).toHaveProperty('budgets')
    expect(res.body.data).toHaveProperty('recurringRules')
    expect(res.body.data.accounts.some((a) => a.id === accountId)).toBe(true)
  })

  it('returns the full account snapshot even with a future timestamp', async () => {
    await accountsRepo.create(pool, { id: accountId, name: 'Sync Test Account 2' })

    const res = await request(app).get('/api/sync').query({ since: '2099-01-01T00:00:00.000Z' })
    expect(res.body.data.accounts.some((a) => a.id === accountId)).toBe(true)
  })

  it('includes soft-deleted rows (tombstones)', async () => {
    await accountsRepo.create(pool, { id: accountId, name: 'Sync Test Account 3' })
    await accountsRepo.softDelete(pool, accountId)

    const res = await request(app).get('/api/sync').query({ since: '2000-01-01T00:00:00.000Z' })
    const row = res.body.data.accounts.find((a) => a.id === accountId)
    expect(row).toBeDefined()
    expect(row.deletedAt).not.toBeNull()
  })

  // Regression: accounts synced via /api/sync had no `balance` field at all
  // (only startingBalance) because the route mapped rows through plain
  // rowToCamel instead of mapAccountRow — the offline client rendered this
  // as "NaN" forever, since a pull() never re-fetches a row whose
  // updated_at hasn't changed again after the initial sync.
  it('includes a computed numeric balance for each account, not just startingBalance', async () => {
    await accountsRepo.create(pool, { id: accountId, name: 'Sync Test Account 4', startingBalance: 10000 })
    await pool.query(
      `INSERT INTO transactions (id, type, amount, account_id, txn_date, updated_at)
       VALUES (?, 'expense', 4200, ?, CURDATE(), NOW())`,
      [randomUUID(), accountId],
    )

    const res = await request(app).get('/api/sync').query({ since: '2000-01-01T00:00:00.000Z' })
    const row = res.body.data.accounts.find((a) => a.id === accountId)
    expect(row.balance).toBe(5800)
  })

  it('returns current transfer balances even when the cursor follows the transaction', async () => {
    await accountsRepo.create(pool, { id: accountId, name: 'Transfer Source', startingBalance: 10000 })
    await accountsRepo.create(pool, { id: otherAccountId, name: 'Transfer Destination', startingBalance: 1000 })
    await pool.query(
      `INSERT INTO transactions (id, type, amount, from_account_id, to_account_id, txn_date, updated_at)
       VALUES (?, 'transfer', 400, ?, ?, CURDATE(), '2099-01-01 00:00:00')`,
      [randomUUID(), accountId, otherAccountId],
    )

    const res = await request(app).get('/api/sync').query({ since: '2100-01-01T00:00:00.000Z' })
    const source = res.body.data.accounts.find((account) => account.id === accountId)
    const destination = res.body.data.accounts.find((account) => account.id === otherAccountId)

    expect(source.balance).toBe(9600)
    expect(destination.balance).toBe(1400)
  })
})

describe('POST /api/sync/push', () => {
  let app
  let accountId
  let categoryId
  let txnId

  beforeEach(async () => {
    app = buildApp()
    accountId = randomUUID()
    categoryId = randomUUID()
    txnId = randomUUID()
    await accountsRepo.create(pool, { id: accountId, name: 'Push Test Account' })
    await categoriesRepo.create(pool, { id: categoryId, name: `Push Test Category ${categoryId}` })
  })

  afterEach(async () => {
    await pool.query('DELETE FROM transactions WHERE id = ?', [txnId])
    await pool.query('DELETE FROM accounts WHERE id = ?', [accountId])
    await pool.query('DELETE FROM categories WHERE id = ?', [categoryId])
  })

  it('rejects an empty ops array', async () => {
    const res = await request(app).post('/api/sync/push').send({ ops: [] })
    expect(res.status).toBe(400)
  })

  it('replays a batch of ops and reports per-op results, out-of-order updatedAt correctly skipped', async () => {
    const res = await request(app)
      .post('/api/sync/push')
      .send({
        ops: [
          {
            entity: 'transactions',
            action: 'create',
            payload: {
              id: txnId,
              type: 'expense',
              amount: 500,
              categoryId,
              accountId,
              txnDate: '2026-07-10',
              updatedAt: '2026-07-10T10:00:00.000Z',
            },
          },
          {
            entity: 'transactions',
            action: 'update',
            payload: {
              id: txnId,
              type: 'expense',
              amount: 999,
              categoryId,
              accountId,
              txnDate: '2026-07-10',
              updatedAt: '2026-07-10T09:00:00.000Z', // older — should skip
            },
          },
        ],
      })

    expect(res.status).toBe(200)
    expect(res.body.data.results).toEqual([
      { id: txnId, status: 'applied' },
      { id: txnId, status: 'skipped' },
    ])
  })

  it('replays a delete op with tombstone propagation', async () => {
    await request(app)
      .post('/api/sync/push')
      .send({
        ops: [
          {
            entity: 'transactions',
            action: 'create',
            payload: {
              id: txnId,
              type: 'expense',
              amount: 500,
              categoryId,
              accountId,
              txnDate: '2026-07-10',
              updatedAt: '2026-07-10T09:00:00.000Z',
            },
          },
        ],
      })

    const res = await request(app)
      .post('/api/sync/push')
      .send({
        ops: [
          {
            entity: 'transactions',
            action: 'delete',
            payload: { id: txnId, updatedAt: '2026-07-10T11:00:00.000Z' },
          },
        ],
      })

    expect(res.body.data.results).toEqual([{ id: txnId, status: 'applied' }])
  })
})
