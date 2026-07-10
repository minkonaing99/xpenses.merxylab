import { afterEach, describe, expect, it } from 'vitest'
import { createXpensesDb, type XpensesDb } from './db'
import { countTransactionsUsingAccount, countTransactionsUsingCategory } from './references'

describe('references', () => {
  let db: XpensesDb

  afterEach(async () => {
    await db?.delete()
  })

  it('countTransactionsUsingAccount counts accountId, fromAccountId, and toAccountId references, excluding deleted txns', async () => {
    db = createXpensesDb('test-refs-account')
    await db.transactions.bulkPut([
      { id: 't1', type: 'expense', amount: 100, note: null, categoryId: null, accountId: 'a1', fromAccountId: null, toAccountId: null, txnDate: '2026-07-01', updatedAt: 'x', deletedAt: null },
      { id: 't2', type: 'transfer', amount: 100, note: null, categoryId: null, accountId: null, fromAccountId: 'a1', toAccountId: 'a2', txnDate: '2026-07-01', updatedAt: 'x', deletedAt: null },
      { id: 't3', type: 'transfer', amount: 100, note: null, categoryId: null, accountId: null, fromAccountId: 'a2', toAccountId: 'a1', txnDate: '2026-07-01', updatedAt: 'x', deletedAt: null },
      { id: 't4', type: 'expense', amount: 100, note: null, categoryId: null, accountId: 'a1', fromAccountId: null, toAccountId: null, txnDate: '2026-07-01', updatedAt: 'x', deletedAt: 'x' },
    ])

    expect(await countTransactionsUsingAccount(db, 'a1')).toBe(3)
    expect(await countTransactionsUsingAccount(db, 'a2')).toBe(2)
    expect(await countTransactionsUsingAccount(db, 'a3')).toBe(0)
  })

  it('countTransactionsUsingCategory counts categoryId references, excluding deleted txns', async () => {
    db = createXpensesDb('test-refs-category')
    await db.transactions.bulkPut([
      { id: 't1', type: 'expense', amount: 100, note: null, categoryId: 'c1', accountId: 'a1', fromAccountId: null, toAccountId: null, txnDate: '2026-07-01', updatedAt: 'x', deletedAt: null },
      { id: 't2', type: 'expense', amount: 100, note: null, categoryId: 'c1', accountId: 'a1', fromAccountId: null, toAccountId: null, txnDate: '2026-07-01', updatedAt: 'x', deletedAt: 'x' },
    ])

    expect(await countTransactionsUsingCategory(db, 'c1')).toBe(1)
    expect(await countTransactionsUsingCategory(db, 'c2')).toBe(0)
  })
})
