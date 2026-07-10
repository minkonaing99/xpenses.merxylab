import type { Table } from 'dexie'
import { apiFetch } from '../lib/fetchClient'
import { getPendingOps, markOpDone, markOpFailed } from './outbox'
import type {
  XpensesDb,
  CachedAccount,
  CachedCategory,
  CachedTransaction,
  CachedBudget,
  CachedRecurringRule,
} from './db'

const EPOCH = '1970-01-01T00:00:00.000Z'

interface SyncPullResponse {
  accounts: CachedAccount[]
  categories: CachedCategory[]
  transactions: CachedTransaction[]
  budgets: CachedBudget[]
  recurringRules: CachedRecurringRule[]
}

interface PushOpResult {
  id: string
  status: 'applied' | 'skipped' | 'error'
  code?: string
}

// Mirrors the server's shouldApply() (server/features/transactions/service.js)
// so a pull never overwrites a locally-newer row still waiting in the outbox.
export function shouldApplyToCache(incomingUpdatedAt: string, existingUpdatedAt?: string): boolean {
  if (existingUpdatedAt == null) return true
  return incomingUpdatedAt >= existingUpdatedAt
}

// Row updatedAt values come back as MySQL DATETIME strings ('YYYY-MM-DD
// HH:MM:SS', always UTC) — not valid per the server's `since` zod schema
// (z.string().datetime(), strict ISO 8601). Used to turn a merged row's
// updatedAt into the next pull's `since` value.
function toIsoDatetime(mysqlDatetime: string): string {
  return `${mysqlDatetime.replace(' ', 'T')}Z`
}

function maxUpdatedAt(rows: Array<{ updatedAt: string }>): string | null {
  return rows.reduce<string | null>((max, row) => (max == null || row.updatedAt > max ? row.updatedAt : max), null)
}

async function mergeRows<T extends { id: string; updatedAt: string }>(
  table: Table<T, string>,
  rows: T[],
): Promise<void> {
  for (const row of rows) {
    const existing = await table.get(row.id)
    if (shouldApplyToCache(row.updatedAt, existing?.updatedAt)) {
      await table.put(row)
    }
  }
}

// Serializes pull()/push() per db instance so an 'online' event and a
// periodic timer firing close together can't interleave and double-submit
// the same outbox ops or race on the lastSyncedAt cursor.
const syncLocks = new WeakMap<XpensesDb, Promise<unknown>>()

function withSyncLock<T>(db: XpensesDb, fn: () => Promise<T>): Promise<T> {
  const prior = syncLocks.get(db) ?? Promise.resolve()
  const next = prior.then(fn, fn)
  syncLocks.set(
    db,
    next.catch(() => undefined),
  )
  return next
}

export function pull(db: XpensesDb): Promise<void> {
  return withSyncLock(db, async () => {
    const sinceEntry = await db.meta.get('lastSyncedAt')
    const since = sinceEntry?.value ?? EPOCH

    const data = await apiFetch<SyncPullResponse>(`/sync?since=${encodeURIComponent(since)}`)

    const allRows = [
      ...data.accounts,
      ...data.categories,
      ...data.transactions,
      ...data.budgets,
      ...data.recurringRules,
    ]
    const observedMax = maxUpdatedAt(allRows)

    // The whole merge + cursor advance is one Dexie transaction so a crash
    // mid-merge can't leave lastSyncedAt pointing past rows that were never
    // written to the cache tables.
    await db.transaction(
      'rw',
      [db.accounts, db.categories, db.transactions, db.budgets, db.recurringRules, db.meta],
      async () => {
        await mergeRows(db.accounts, data.accounts)
        await mergeRows(db.categories, data.categories)
        await mergeRows(db.transactions, data.transactions)
        await mergeRows(db.budgets, data.budgets)
        await mergeRows(db.recurringRules, data.recurringRules)

        // Advance the cursor from the data actually merged, not a client
        // clock snapshot — a "now" captured before the round trip can sit
        // ahead of a row that's still in flight server-side, permanently
        // skipping it on the next pull. No rows changed -> leave the cursor
        // where it was (safe no-op re-scan next time).
        if (observedMax != null) {
          await db.meta.put({ key: 'lastSyncedAt', value: toIsoDatetime(observedMax) })
        }
      },
    )
  })
}

export function push(db: XpensesDb): Promise<PushOpResult[]> {
  return withSyncLock(db, async () => {
    const pending = await getPendingOps(db)
    if (pending.length === 0) return []

    const { results } = await apiFetch<{ results: PushOpResult[] }>('/sync/push', {
      method: 'POST',
      body: JSON.stringify({
        ops: pending.map((op) => ({ entity: op.entity, action: op.action, payload: op.payload })),
      }),
    })

    if (results.length !== pending.length) {
      throw new Error(
        `sync/push result count mismatch: sent ${pending.length} ops, got ${results.length} results`,
      )
    }

    // One transaction for the whole batch: if a single status write throws,
    // Dexie aborts all of it and every op in this batch stays 'pending' —
    // safe to resend, since applied/skip outcomes are idempotent server-side.
    await db.transaction('rw', db.outbox, async () => {
      for (let index = 0; index < pending.length; index += 1) {
        const opId = pending[index].opId as number
        const result = results[index]
        // 'skipped' means the server's LWW guard rejected this op as stale —
        // resubmitting it will never succeed, so it's cleared like 'applied'.
        if (result.status === 'error') {
          await markOpFailed(db, opId)
        } else {
          await markOpDone(db, opId)
        }
      }
    })

    return results
  })
}
