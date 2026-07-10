'use strict'

const { randomUUID } = require('crypto')
const { getPool } = require('../../../db/pool')
const accountsRepo = require('../../accounts/repo')
const categoriesRepo = require('../../categories/repo')
const txnRepo = require('../../transactions/repo')
const repo = require('../repo')

const pool = getPool()

afterAll(async () => {
  await pool.end()
})

describe('reports repo', () => {
  let accountId
  let categoryId
  let txnIds

  beforeEach(async () => {
    accountId = randomUUID()
    categoryId = randomUUID()
    txnIds = []
    await accountsRepo.create(pool, { id: accountId, name: 'Reports Test Account' })
    await categoriesRepo.create(pool, { id: categoryId, name: `Reports Test Category ${categoryId}` })
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

  describe('categorySpend', () => {
    it('sums expense amounts per category within the month', async () => {
      await makeTxn('expense', 4200, '2026-07-05')
      await makeTxn('expense', 2220, '2026-07-06')
      await makeTxn('expense', 1000, '2026-08-01') // different month — excluded
      await makeTxn('income', 50000, '2026-07-01') // not an expense — excluded

      const rows = await repo.categorySpend(pool, '2026-07')
      const row = rows.find((r) => r.category_id === categoryId)
      expect(Number(row.total)).toBe(6420)
    })

    it('excludes categories with no expenses that month', async () => {
      const rows = await repo.categorySpend(pool, '2026-07')
      expect(rows.some((r) => r.category_id === categoryId)).toBe(false)
    })
  })

  describe('monthlyTotals', () => {
    it('returns separate income and expense totals for the month', async () => {
      // monthlyTotals is a true global aggregate (no account/category
      // filter) — use a month no other test fixture touches so this
      // assertion stays correct even if tests ever run in parallel again
      // (see docs/SETUP.md "Known gaps" re: --runInBand).
      await makeTxn('income', 50000, '2031-11-01')
      await makeTxn('expense', 32000, '2031-11-05')
      await makeTxn('expense', 1000, '2031-12-01') // excluded — different month

      const totals = await repo.monthlyTotals(pool, '2031-11')
      expect(totals).toEqual({ income: 50000, expense: 32000 })
    })

    it('returns zero for a month with no activity', async () => {
      const totals = await repo.monthlyTotals(pool, '2099-01')
      expect(totals).toEqual({ income: 0, expense: 0 })
    })
  })
})
