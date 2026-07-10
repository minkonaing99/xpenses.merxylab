import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { createXpensesDb, type XpensesDb } from './db'
import { useAccounts, useCategories, useTransactions, useBudgets, useRecurringRules, useOutboxStatus } from './hooks'

describe('offline hooks', () => {
  let db: XpensesDb

  afterEach(async () => {
    await db?.delete()
  })

  it('useAccounts returns non-deleted accounts sorted by sortOrder', async () => {
    db = createXpensesDb('test-hooks-accounts')
    await db.accounts.bulkPut([
      { id: 'a2', name: 'Bank', type: 'bank', startingBalance: 0, balance: 0, sortOrder: 1, updatedAt: 'x', deletedAt: null },
      { id: 'a1', name: 'Cash', type: 'cash', startingBalance: 0, balance: 0, sortOrder: 0, updatedAt: 'x', deletedAt: null },
      { id: 'a3', name: 'Gone', type: 'cash', startingBalance: 0, balance: 0, sortOrder: 2, updatedAt: 'x', deletedAt: 'x' },
    ])

    const { result } = renderHook(() => useAccounts(db))

    await waitFor(() => expect(result.current).toBeDefined())
    expect(result.current?.map((a) => a.id)).toEqual(['a1', 'a2'])
  })

  it('useCategories returns non-deleted categories sorted by sortOrder', async () => {
    db = createXpensesDb('test-hooks-categories')
    await db.categories.bulkPut([
      { id: 'c2', name: 'Transport', icon: null, sortOrder: 1, updatedAt: 'x', deletedAt: null },
      { id: 'c1', name: 'Food', icon: null, sortOrder: 0, updatedAt: 'x', deletedAt: null },
    ])

    const { result } = renderHook(() => useCategories(db))

    await waitFor(() => expect(result.current).toBeDefined())
    expect(result.current?.map((c) => c.id)).toEqual(['c1', 'c2'])
  })

  it('useTransactions filters by month and excludes deleted rows', async () => {
    db = createXpensesDb('test-hooks-transactions')
    await db.transactions.bulkPut([
      { id: 't1', type: 'expense', amount: 100, note: null, categoryId: 'c1', accountId: 'a1', fromAccountId: null, toAccountId: null, txnDate: '2026-07-05', updatedAt: '2026-07-05 09:00:00', deletedAt: null },
      { id: 't2', type: 'expense', amount: 200, note: null, categoryId: 'c1', accountId: 'a1', fromAccountId: null, toAccountId: null, txnDate: '2026-06-05', updatedAt: '2026-06-05 09:00:00', deletedAt: null },
      { id: 't3', type: 'expense', amount: 300, note: null, categoryId: 'c1', accountId: 'a1', fromAccountId: null, toAccountId: null, txnDate: '2026-07-06', updatedAt: '2026-07-06 09:00:00', deletedAt: '2026-07-06 09:00:00' },
    ])

    const { result } = renderHook(() => useTransactions(db, { month: '2026-07' }))

    await waitFor(() => expect(result.current).toBeDefined())
    expect(result.current?.map((t) => t.id)).toEqual(['t1'])
  })

  it('useTransactions sorts by txnDate descending', async () => {
    db = createXpensesDb('test-hooks-transactions-sort')
    await db.transactions.bulkPut([
      { id: 't1', type: 'expense', amount: 100, note: null, categoryId: 'c1', accountId: 'a1', fromAccountId: null, toAccountId: null, txnDate: '2026-07-01', updatedAt: '2026-07-01 09:00:00', deletedAt: null },
      { id: 't2', type: 'expense', amount: 200, note: null, categoryId: 'c1', accountId: 'a1', fromAccountId: null, toAccountId: null, txnDate: '2026-07-10', updatedAt: '2026-07-10 09:00:00', deletedAt: null },
    ])

    const { result } = renderHook(() => useTransactions(db))

    await waitFor(() => expect(result.current).toBeDefined())
    expect(result.current?.map((t) => t.id)).toEqual(['t2', 't1'])
  })

  it('useBudgets returns non-deleted budgets', async () => {
    db = createXpensesDb('test-hooks-budgets')
    await db.budgets.put({ id: 'b1', categoryId: 'c1', limitAmount: 60000, updatedAt: 'x', deletedAt: null })

    const { result } = renderHook(() => useBudgets(db))

    await waitFor(() => expect(result.current).toBeDefined())
    expect(result.current?.map((b) => b.id)).toEqual(['b1'])
  })

  it('useRecurringRules returns non-deleted rules', async () => {
    db = createXpensesDb('test-hooks-recurring')
    await db.recurringRules.put({
      id: 'r1', type: 'expense', amount: 5000, note: null, categoryId: 'c1', accountId: 'a1',
      fromAccountId: null, toAccountId: null, intervalUnit: 'month', intervalCount: 1,
      nextRunDate: '2026-08-01', active: true, updatedAt: 'x', deletedAt: null,
    })

    const { result } = renderHook(() => useRecurringRules(db))

    await waitFor(() => expect(result.current).toBeDefined())
    expect(result.current?.map((r) => r.id)).toEqual(['r1'])
  })

  it('useOutboxStatus counts pending and failed ops separately', async () => {
    db = createXpensesDb('test-hooks-outbox-status')
    await db.outbox.bulkAdd([
      { entity: 'accounts', action: 'create', payload: { id: 'a1' }, createdAt: 'x', status: 'pending' },
      { entity: 'accounts', action: 'create', payload: { id: 'a2' }, createdAt: 'x', status: 'pending' },
      { entity: 'transactions', action: 'update', payload: { id: 't1' }, createdAt: 'x', status: 'failed' },
    ])

    const { result } = renderHook(() => useOutboxStatus(db))

    await waitFor(() => expect(result.current).toBeDefined())
    expect(result.current).toEqual({ pending: 2, failed: 1 })
  })
})
