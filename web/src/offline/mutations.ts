import type { Table } from 'dexie'
import type {
  XpensesDb,
  OutboxEntity,
  OutboxAction,
  CachedAccount,
  CachedCategory,
  CachedTransaction,
  CachedBudget,
  CachedRecurringRule,
} from './db'
import { enqueue } from './outbox'
import { push } from './sync'

function tableFor(db: XpensesDb, entity: OutboxEntity): Table<Record<string, unknown>, string> {
  const map: Record<OutboxEntity, Table<Record<string, unknown>, string>> = {
    accounts: db.accounts as unknown as Table<Record<string, unknown>, string>,
    categories: db.categories as unknown as Table<Record<string, unknown>, string>,
    transactions: db.transactions as unknown as Table<Record<string, unknown>, string>,
    budgets: db.budgets as unknown as Table<Record<string, unknown>, string>,
    recurring: db.recurringRules as unknown as Table<Record<string, unknown>, string>,
  }
  return map[entity]
}

// Cache write + outbox enqueue happen in one Dexie transaction (move
// together or not at all, mirroring sync.ts's atomicity discipline). The
// network push happens after commit, best-effort — the op is already
// durably queued, so a failed/offline push here is a no-op; the next
// online/timer sync cycle (wired in SyncBoot) retries it.
async function applyWrite(
  db: XpensesDb,
  entity: OutboxEntity,
  action: OutboxAction,
  id: string,
  cachePatch: object,
  apiPayload: object,
): Promise<void> {
  const table = tableFor(db, entity)
  await db.transaction('rw', [table, db.outbox], async () => {
    if (action === 'create') {
      await table.put({ id, ...cachePatch })
    } else {
      await table.update(id, cachePatch)
    }
    await enqueue(db, entity, action, { id, ...apiPayload })
  })
  void push(db).catch(() => undefined)
}

export interface AccountInput {
  name: string
  type: string
  startingBalance: number
  sortOrder?: number
}

export async function createAccount(db: XpensesDb, input: AccountInput): Promise<CachedAccount> {
  const id = crypto.randomUUID()
  const row: CachedAccount = {
    id,
    name: input.name,
    type: input.type,
    startingBalance: input.startingBalance,
    balance: input.startingBalance,
    sortOrder: input.sortOrder ?? 0,
    updatedAt: new Date().toISOString(),
    deletedAt: null,
  }
  await applyWrite(db, 'accounts', 'create', id, row, {
    name: row.name,
    type: row.type,
    startingBalance: row.startingBalance,
  })
  return row
}

export async function updateAccount(db: XpensesDb, id: string, patch: Partial<AccountInput>): Promise<void> {
  const updatedAt = new Date().toISOString()
  await applyWrite(db, 'accounts', 'update', id, { ...patch, updatedAt }, { ...patch, updatedAt })
}

export async function deleteAccount(db: XpensesDb, id: string): Promise<void> {
  const updatedAt = new Date().toISOString()
  await applyWrite(db, 'accounts', 'delete', id, { deletedAt: updatedAt, updatedAt }, {})
}

export interface CategoryInput {
  name: string
  icon?: string | null
  sortOrder?: number
}

export async function createCategory(db: XpensesDb, input: CategoryInput): Promise<CachedCategory> {
  const id = crypto.randomUUID()
  const row: CachedCategory = {
    id,
    name: input.name,
    icon: input.icon ?? null,
    sortOrder: input.sortOrder ?? 0,
    updatedAt: new Date().toISOString(),
    deletedAt: null,
  }
  await applyWrite(db, 'categories', 'create', id, row, { name: row.name, icon: row.icon })
  return row
}

export async function updateCategory(db: XpensesDb, id: string, patch: Partial<CategoryInput>): Promise<void> {
  const updatedAt = new Date().toISOString()
  await applyWrite(db, 'categories', 'update', id, { ...patch, updatedAt }, { ...patch, updatedAt })
}

export async function deleteCategory(db: XpensesDb, id: string): Promise<void> {
  const updatedAt = new Date().toISOString()
  await applyWrite(db, 'categories', 'delete', id, { deletedAt: updatedAt, updatedAt }, {})
}

export interface TransactionInput {
  type: string
  amount: number
  note: string | null
  categoryId: string | null
  accountId: string | null
  fromAccountId: string | null
  toAccountId: string | null
  txnDate: string
}

function fullTxnPayload(row: CachedTransaction): Record<string, unknown> {
  return {
    type: row.type,
    amount: row.amount,
    note: row.note,
    categoryId: row.categoryId,
    accountId: row.accountId,
    fromAccountId: row.fromAccountId,
    toAccountId: row.toAccountId,
    txnDate: row.txnDate,
    updatedAt: row.updatedAt,
  }
}

export async function createTransaction(db: XpensesDb, input: TransactionInput): Promise<CachedTransaction> {
  const id = crypto.randomUUID()
  const row: CachedTransaction = { id, ...input, updatedAt: new Date().toISOString(), deletedAt: null }
  await applyWrite(db, 'transactions', 'create', id, row, fullTxnPayload(row))
  return row
}

// The server upserts transactions on the full object every time (no partial
// PATCH semantics for the payload sent over the wire) — merge the patch into
// the existing cached row before enqueuing so the outbox op is complete.
//
// Bypasses the generic applyWrite() helper: that helper takes an
// already-built patch, but this needs to READ the current row and WRITE the
// merge in the same Dexie transaction. Reading outside the transaction (the
// original bug here) let a concurrent editor — another open tab, or a pull()
// merge landing mid-edit — commit between the read and the write, silently
// reverting whatever the other writer had just set.
export async function updateTransaction(
  db: XpensesDb,
  id: string,
  patch: Partial<TransactionInput>,
): Promise<void> {
  let row: CachedTransaction | undefined
  await db.transaction('rw', [db.transactions, db.outbox], async () => {
    const existing = await db.transactions.get(id)
    if (!existing) throw new Error(`updateTransaction: no cached transaction ${id}`)
    row = { ...existing, ...patch, updatedAt: new Date().toISOString() }
    await db.transactions.put(row)
    await enqueue(db, 'transactions', 'update', { id, ...fullTxnPayload(row) })
  })
  void push(db).catch(() => undefined)
}

export async function deleteTransaction(db: XpensesDb, id: string): Promise<void> {
  const updatedAt = new Date().toISOString()
  await applyWrite(db, 'transactions', 'delete', id, { deletedAt: updatedAt, updatedAt }, { updatedAt })
}

export interface BudgetInput {
  categoryId: string
  limitAmount: number
}

export async function createBudget(db: XpensesDb, input: BudgetInput): Promise<CachedBudget> {
  const id = crypto.randomUUID()
  const row: CachedBudget = { id, ...input, updatedAt: new Date().toISOString(), deletedAt: null }
  await applyWrite(db, 'budgets', 'create', id, row, { categoryId: row.categoryId, limitAmount: row.limitAmount })
  return row
}

export async function updateBudget(db: XpensesDb, id: string, limitAmount: number): Promise<void> {
  const updatedAt = new Date().toISOString()
  await applyWrite(db, 'budgets', 'update', id, { limitAmount, updatedAt }, { limitAmount })
}

export async function deleteBudget(db: XpensesDb, id: string): Promise<void> {
  const updatedAt = new Date().toISOString()
  await applyWrite(db, 'budgets', 'delete', id, { deletedAt: updatedAt, updatedAt }, {})
}

export interface RecurringRuleInput {
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
}

export async function createRecurringRule(
  db: XpensesDb,
  input: RecurringRuleInput,
): Promise<CachedRecurringRule> {
  const id = crypto.randomUUID()
  const row: CachedRecurringRule = {
    id,
    ...input,
    active: true,
    updatedAt: new Date().toISOString(),
    deletedAt: null,
  }
  const { type, amount, note, categoryId, accountId, fromAccountId, toAccountId, intervalUnit, intervalCount, nextRunDate, active } = row
  await applyWrite(db, 'recurring', 'create', id, row, {
    type,
    amount,
    note,
    categoryId,
    accountId,
    fromAccountId,
    toAccountId,
    intervalUnit,
    intervalCount,
    nextRunDate,
    active,
  })
  return row
}

export async function updateRecurringRule(
  db: XpensesDb,
  id: string,
  patch: Partial<RecurringRuleInput> & { active?: boolean },
): Promise<void> {
  const updatedAt = new Date().toISOString()
  await applyWrite(db, 'recurring', 'update', id, { ...patch, updatedAt }, { ...patch, updatedAt })
}

export async function deleteRecurringRule(db: XpensesDb, id: string): Promise<void> {
  const updatedAt = new Date().toISOString()
  await applyWrite(db, 'recurring', 'delete', id, { deletedAt: updatedAt, updatedAt }, {})
}
