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

describe('transactions repo', () => {
  let accountId
  let categoryId
  let txnIds
  let extraAccountIds

  beforeEach(async () => {
    accountId = randomUUID()
    categoryId = randomUUID()
    txnIds = []
    extraAccountIds = []
    await accountsRepo.create(pool, { id: accountId, name: 'Txn Test Account' })
    await categoriesRepo.create(pool, { id: categoryId, name: `Txn Test Category ${categoryId}` })
  })

  afterEach(async () => {
    for (const id of txnIds) {
      await pool.query('DELETE FROM transactions WHERE id = ?', [id])
    }
    for (const id of extraAccountIds) {
      await pool.query('DELETE FROM accounts WHERE id = ?', [id])
    }
    await pool.query('DELETE FROM accounts WHERE id = ?', [accountId])
    await pool.query('DELETE FROM categories WHERE id = ?', [categoryId])
  })

  async function makeTxn(overrides = {}) {
    const id = randomUUID()
    txnIds.push(id)
    await repo.create(pool, {
      id,
      type: 'expense',
      amount: 1000,
      note: 'test',
      categoryId,
      accountId,
      fromAccountId: null,
      toAccountId: null,
      txnDate: '2026-07-10',
      updatedAt: '2026-07-10 09:00:00',
      ...overrides,
    })
    return id
  }

  it('creates and finds a transaction by id', async () => {
    const id = await makeTxn({ amount: 4200 })
    const found = await repo.findById(pool, id)
    expect(found).toMatchObject({ id, amount: 4200, type: 'expense' })
  })

  it('returns null for a non-existent id', async () => {
    expect(await repo.findById(pool, randomUUID())).toBeNull()
  })

  it('filters by type', async () => {
    await makeTxn({ type: 'expense', categoryId, accountId, fromAccountId: null, toAccountId: null })
    await makeTxn({
      type: 'income',
      categoryId: null,
      accountId,
      fromAccountId: null,
      toAccountId: null,
      amount: 5000,
    })

    const { rows } = await repo.findAll(pool, { type: 'income' })
    expect(rows.every((r) => r.type === 'income')).toBe(true)
    expect(rows.some((r) => r.account_id === accountId)).toBe(true)
  })

  it('filters by month', async () => {
    await makeTxn({ txnDate: '2026-07-15' })
    await makeTxn({ txnDate: '2026-08-01' })

    const { rows } = await repo.findAll(pool, { month: '2026-07', accountId })
    expect(rows.length).toBe(1)
    expect(rows[0].txn_date).toBe('2026-07-15')
  })

  it('filters by accountId across account_id/from_account_id/to_account_id', async () => {
    const otherAccountId = randomUUID()
    extraAccountIds.push(otherAccountId)
    await accountsRepo.create(pool, { id: otherAccountId, name: 'Other' })
    await makeTxn({
      type: 'transfer',
      categoryId: null,
      accountId: null,
      fromAccountId: accountId,
      toAccountId: otherAccountId,
      amount: 100,
    })

    const { rows } = await repo.findAll(pool, { accountId })
    expect(rows.some((r) => r.from_account_id === accountId)).toBe(true)
  })

  it('paginates with limit + cursor', async () => {
    await makeTxn({ txnDate: '2026-07-01' })
    await makeTxn({ txnDate: '2026-07-02' })
    await makeTxn({ txnDate: '2026-07-03' })

    const page1 = await repo.findAll(pool, { accountId, limit: 2 })
    expect(page1.rows.length).toBe(2)
    expect(page1.nextCursor).not.toBeNull()

    const page2 = await repo.findAll(pool, { accountId, limit: 2, cursor: page1.nextCursor })
    expect(page2.rows.length).toBe(1)
    const allIds = [...page1.rows, ...page2.rows].map((r) => r.id)
    expect(new Set(allIds).size).toBe(3)
  })

  it('updates only the given fields', async () => {
    const id = await makeTxn({ note: 'before' })
    await repo.update(pool, id, { note: 'after', updatedAt: '2026-07-10 10:00:00' })
    const found = await repo.findById(pool, id)
    expect(found.note).toBe('after')
    expect(found.amount).toBe(1000)
  })

  it('soft-deletes, excluding it from findById', async () => {
    const id = await makeTxn()
    await repo.softDelete(pool, id, '2026-07-10 11:00:00')
    expect(await repo.findById(pool, id)).toBeNull()
  })

  it('findChangedSince includes rows updated after the given timestamp, incl. tombstones', async () => {
    const id = await makeTxn()
    const before = await repo.findChangedSince(pool, '2000-01-01 00:00:00')
    expect(before.some((r) => r.id === id)).toBe(true)

    await repo.softDelete(pool, id, '2026-07-10 11:00:00')
    const afterDelete = await repo.findChangedSince(pool, '2000-01-01 00:00:00')
    expect(afterDelete.find((r) => r.id === id).deleted_at).not.toBeNull()
  })
})
