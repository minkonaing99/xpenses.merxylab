import type { XpensesDb } from './db'

export function countTransactionsUsingAccount(db: XpensesDb, accountId: string): Promise<number> {
  return db.transactions
    .filter(
      (t) =>
        t.deletedAt == null &&
        (t.accountId === accountId || t.fromAccountId === accountId || t.toAccountId === accountId),
    )
    .count()
}

export function countTransactionsUsingCategory(db: XpensesDb, categoryId: string): Promise<number> {
  return db.transactions.filter((t) => t.deletedAt == null && t.categoryId === categoryId).count()
}
