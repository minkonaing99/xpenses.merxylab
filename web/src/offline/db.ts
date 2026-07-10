import Dexie, { type Table } from 'dexie'

export interface CachedAccount {
  id: string
  name: string
  type: string
  startingBalance: number
  balance: number
  sortOrder: number
  updatedAt: string
  deletedAt: string | null
}

export interface CachedCategory {
  id: string
  name: string
  icon: string | null
  sortOrder: number
  updatedAt: string
  deletedAt: string | null
}

export interface CachedTransaction {
  id: string
  type: string
  amount: number
  note: string | null
  categoryId: string | null
  accountId: string | null
  fromAccountId: string | null
  toAccountId: string | null
  txnDate: string
  updatedAt: string
  deletedAt: string | null
}

export interface CachedBudget {
  id: string
  categoryId: string
  limitAmount: number
  updatedAt: string
  deletedAt: string | null
}

export interface CachedRecurringRule {
  id: string
  type: string
  amount: number
  note: string | null
  categoryId: string | null
  accountId: string | null
  fromAccountId: string | null
  toAccountId: string | null
  intervalUnit: string
  intervalCount: number
  nextRunDate: string
  active: boolean
  updatedAt: string
  deletedAt: string | null
}

export type OutboxEntity = 'accounts' | 'categories' | 'transactions' | 'budgets' | 'recurring'
export type OutboxAction = 'create' | 'update' | 'delete'
export type OutboxStatus = 'pending' | 'failed'

export interface OutboxOp {
  opId?: number
  entity: OutboxEntity
  action: OutboxAction
  payload: Record<string, unknown>
  createdAt: string
  status: OutboxStatus
}

export interface MetaEntry {
  key: string
  value: string
}

export class XpensesDb extends Dexie {
  accounts!: Table<CachedAccount, string>
  categories!: Table<CachedCategory, string>
  transactions!: Table<CachedTransaction, string>
  budgets!: Table<CachedBudget, string>
  recurringRules!: Table<CachedRecurringRule, string>
  outbox!: Table<OutboxOp, number>
  meta!: Table<MetaEntry, string>

  constructor(name: string) {
    super(name)
    this.version(1).stores({
      accounts: 'id, updatedAt',
      categories: 'id, updatedAt',
      transactions: 'id, updatedAt, txnDate',
      budgets: 'id, updatedAt',
      recurringRules: 'id, updatedAt',
      outbox: '++opId, status, createdAt',
      meta: 'key',
    })
  }
}

export function createXpensesDb(name: string): XpensesDb {
  return new XpensesDb(name)
}

export const db = createXpensesDb('xpenses')
