import { useLiveQuery } from 'dexie-react-hooks'
import type { XpensesDb, CachedAccount, CachedCategory, CachedTransaction, CachedBudget, CachedRecurringRule } from './db'

export function useAccounts(db: XpensesDb): CachedAccount[] | undefined {
  return useLiveQuery(
    () => db.accounts.filter((a) => a.deletedAt == null).sortBy('sortOrder'),
    [db],
  )
}

export function useCategories(db: XpensesDb): CachedCategory[] | undefined {
  return useLiveQuery(
    () => db.categories.filter((c) => c.deletedAt == null).sortBy('sortOrder'),
    [db],
  )
}

export interface TransactionFilter {
  month?: string
  type?: string
  accountId?: string
  categoryId?: string
}

export function useTransactions(db: XpensesDb, filter: TransactionFilter = {}): CachedTransaction[] | undefined {
  const { month, type, accountId, categoryId } = filter
  return useLiveQuery(async () => {
    let rows = await db.transactions.filter((t) => t.deletedAt == null).toArray()
    if (month) rows = rows.filter((t) => t.txnDate.startsWith(month))
    if (type) rows = rows.filter((t) => t.type === type)
    if (accountId) {
      rows = rows.filter(
        (t) => t.accountId === accountId || t.fromAccountId === accountId || t.toAccountId === accountId,
      )
    }
    if (categoryId) rows = rows.filter((t) => t.categoryId === categoryId)
    return rows.sort((a, b) => (a.txnDate === b.txnDate ? b.updatedAt.localeCompare(a.updatedAt) : b.txnDate.localeCompare(a.txnDate)))
  }, [db, month, type, accountId, categoryId])
}

export function useBudgets(db: XpensesDb): CachedBudget[] | undefined {
  return useLiveQuery(() => db.budgets.filter((b) => b.deletedAt == null).toArray(), [db])
}

export function useRecurringRules(db: XpensesDb): CachedRecurringRule[] | undefined {
  return useLiveQuery(() => db.recurringRules.filter((r) => r.deletedAt == null).toArray(), [db])
}

export interface OutboxStatus {
  pending: number
  failed: number
}

// Surfaces the outbox's sync state so a silently-failed write (the server
// rejected a pushed op, or an LWW guard skipped a stale one) is visible
// somewhere instead of vanishing after the optimistic write already showed
// success.
export function useOutboxStatus(db: XpensesDb): OutboxStatus | undefined {
  return useLiveQuery(async () => {
    const [pending, failed] = await Promise.all([
      db.outbox.where('status').equals('pending').count(),
      db.outbox.where('status').equals('failed').count(),
    ])
    return { pending, failed }
  }, [db])
}
