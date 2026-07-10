'use strict'

const { randomUUID } = require('crypto')
const { getPool } = require('../../../db/pool')
const categoriesRepo = require('../../categories/repo')
const accountsRepo = require('../../accounts/repo')
const txnRepo = require('../../transactions/repo')
const repo = require('../repo')

const pool = getPool()

afterAll(async () => {
  await pool.end()
})

describe('budgets repo', () => {
  let categoryId
  let budgetId
  let accountId
  let txnIds

  beforeEach(async () => {
    categoryId = randomUUID()
    budgetId = randomUUID()
    accountId = randomUUID()
    txnIds = []
    await categoriesRepo.create(pool, { id: categoryId, name: `Budget Test Category ${categoryId}` })
    await accountsRepo.create(pool, { id: accountId, name: 'Budget Test Account' })
    await repo.create(pool, { id: budgetId, categoryId, limitAmount: 6000 })
  })

  afterEach(async () => {
    for (const id of txnIds) {
      await pool.query('DELETE FROM transactions WHERE id = ?', [id])
    }
    await pool.query('DELETE FROM budgets WHERE id = ?', [budgetId])
    await pool.query('DELETE FROM accounts WHERE id = ?', [accountId])
    await pool.query('DELETE FROM categories WHERE id = ?', [categoryId])
  })

  it('creates and finds a budget by id', async () => {
    const found = await repo.findById(pool, budgetId)
    expect(found).toMatchObject({ id: budgetId, category_id: categoryId, limit_amount: 6000 })
  })

  it('returns null for a non-existent id', async () => {
    expect(await repo.findById(pool, randomUUID())).toBeNull()
  })

  it('findAllWithSpent includes zero spent when there are no expenses', async () => {
    const rows = await repo.findAllWithSpent(pool, '2026-07')
    const row = rows.find((r) => r.id === budgetId)
    expect(row.spent).toBe('0')
  })

  it('findAllWithSpent sums only expense transactions in the given month for that category', async () => {
    async function makeExpense(amount, txnDate) {
      const id = randomUUID()
      txnIds.push(id)
      await txnRepo.create(pool, {
        id,
        type: 'expense',
        amount,
        categoryId,
        accountId,
        txnDate,
        updatedAt: '2026-07-10 09:00:00',
      })
    }

    await makeExpense(4200, '2026-07-05')
    await makeExpense(2220, '2026-07-06')
    await makeExpense(1000, '2026-08-01') // different month — excluded

    const rows = await repo.findAllWithSpent(pool, '2026-07')
    const row = rows.find((r) => r.id === budgetId)
    expect(Number(row.spent)).toBe(6420)
  })

  it('updates only the given fields', async () => {
    await repo.update(pool, budgetId, { limitAmount: 8000 })
    const found = await repo.findById(pool, budgetId)
    expect(found.limit_amount).toBe(8000)
  })

  it('soft-deletes, excluding it from findById', async () => {
    await repo.softDelete(pool, budgetId)
    expect(await repo.findById(pool, budgetId)).toBeNull()
  })

  it('findActiveByCategoryId finds a non-deleted budget for the category', async () => {
    const found = await repo.findActiveByCategoryId(pool, categoryId)
    expect(found.id).toBe(budgetId)
  })

  it('findActiveByCategoryId excludes the given id', async () => {
    expect(await repo.findActiveByCategoryId(pool, categoryId, budgetId)).toBeNull()
  })

  it('findActiveByCategoryId returns null once soft-deleted — category is free again', async () => {
    await repo.softDelete(pool, budgetId)
    expect(await repo.findActiveByCategoryId(pool, categoryId)).toBeNull()
  })

  it('findChangedSince includes rows updated after the given timestamp', async () => {
    const rows = await repo.findChangedSince(pool, '2000-01-01 00:00:00')
    expect(rows.some((r) => r.id === budgetId)).toBe(true)
  })
})
