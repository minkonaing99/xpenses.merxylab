import { describe, expect, it } from 'vitest'
import { calculateNet, formatTxnDate, iconForTxn, toTxnRowProps } from './txnMapping'
import type { CachedTransaction, CachedCategory, CachedAccount } from '../../offline/db'

describe('calculateNet', () => {
  it('sums income and subtracts expense, ignoring transfers', () => {
    const txns = [
      { type: 'income', amount: 5000 },
      { type: 'expense', amount: 2000 },
      { type: 'transfer', amount: 9999 },
    ] as CachedTransaction[]
    expect(calculateNet(txns)).toBe(3000)
  })

  it('returns 0 for no transactions', () => {
    expect(calculateNet([])).toBe(0)
  })
})

describe('formatTxnDate', () => {
  it('returns "Today" when the txnDate matches today', () => {
    expect(formatTxnDate('2026-07-10', '2026-07-10')).toBe('Today')
  })

  it('formats other dates as short month + day', () => {
    expect(formatTxnDate('2026-07-05', '2026-07-10')).toBe('Jul 5')
  })
})

describe('iconForTxn', () => {
  it('returns arrows-left-right for transfers regardless of category', () => {
    expect(iconForTxn('transfer', 'Food')).toBe('arrows-left-right')
  })

  it('maps a known category name to its icon', () => {
    expect(iconForTxn('expense', 'Food')).toBe('bowl-food')
    expect(iconForTxn('expense', 'Health')).toBe('heartbeat')
  })

  it('falls back to question for an unknown or missing category', () => {
    expect(iconForTxn('expense', undefined)).toBe('question')
    expect(iconForTxn('expense', 'Nonexistent')).toBe('question')
  })
})

describe('toTxnRowProps', () => {
  const categoriesById = new Map<string, CachedCategory>([
    ['c1', { id: 'c1', name: 'Food', icon: null, sortOrder: 0, updatedAt: 'x', deletedAt: null }],
  ])
  const accountsById = new Map<string, CachedAccount>([
    ['a1', { id: 'a1', name: 'Cash', type: 'cash', startingBalance: 0, balance: 0, sortOrder: 0, updatedAt: 'x', deletedAt: null }],
    ['a2', { id: 'a2', name: 'Bank', type: 'bank', startingBalance: 0, balance: 0, sortOrder: 1, updatedAt: 'x', deletedAt: null }],
  ])
  const ctx = { categoriesById, accountsById, today: '2026-07-10' }

  it('maps an expense to a category caption and icon', () => {
    const txn: CachedTransaction = {
      id: 't1', type: 'expense', amount: 8600, note: '', categoryId: 'c1', accountId: 'a1',
      fromAccountId: null, toAccountId: null, txnDate: '2026-07-10', updatedAt: 'x', deletedAt: null,
    }
    const props = toTxnRowProps(txn, ctx)
    expect(props).toMatchObject({ icon: 'bowl-food', caption: 'Food · Today', amountSatang: 8600, type: 'expense' })
    expect(props.note).toBe('Food')
  })

  it('uses the note when present instead of the category name', () => {
    const txn: CachedTransaction = {
      id: 't1', type: 'expense', amount: 8600, note: 'Big C groceries', categoryId: 'c1', accountId: 'a1',
      fromAccountId: null, toAccountId: null, txnDate: '2026-07-10', updatedAt: 'x', deletedAt: null,
    }
    expect(toTxnRowProps(txn, ctx).note).toBe('Big C groceries')
  })

  it('maps income to the account name', () => {
    const txn: CachedTransaction = {
      id: 't2', type: 'income', amount: 4500000, note: '', categoryId: null, accountId: 'a1',
      fromAccountId: null, toAccountId: null, txnDate: '2026-07-08', updatedAt: 'x', deletedAt: null,
    }
    const props = toTxnRowProps(txn, ctx)
    expect(props).toMatchObject({ icon: 'money-wavy', caption: 'Cash · Jul 8', type: 'income' })
  })

  it('maps a transfer to a from -> to caption', () => {
    const txn: CachedTransaction = {
      id: 't3', type: 'transfer', amount: 500000, note: '', categoryId: null, accountId: null,
      fromAccountId: 'a1', toAccountId: 'a2', txnDate: '2026-07-02', updatedAt: 'x', deletedAt: null,
    }
    const props = toTxnRowProps(txn, ctx)
    expect(props).toMatchObject({ icon: 'arrows-left-right', caption: 'Cash → Bank · Jul 2', type: 'transfer' })
  })
})
