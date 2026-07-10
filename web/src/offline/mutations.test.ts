import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createXpensesDb, type XpensesDb } from './db'
import {
  createAccount,
  updateAccount,
  deleteAccount,
  createCategory,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  createBudget,
  createRecurringRule,
} from './mutations'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status })
}

describe('mutations', () => {
  let db: XpensesDb

  beforeEach(() => {
    // mockImplementation (not mockResolvedValue) so each call gets a fresh
    // Response — a Response body can only be read once, and several tests
    // here trigger more than one push() in a single test.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() =>
        Promise.resolve(jsonResponse({ ok: true, data: { results: [{ id: 'x', status: 'applied' }] } })),
      ),
    )
  })

  afterEach(async () => {
    vi.unstubAllGlobals()
    await db?.delete()
  })

  it('createAccount writes an optimistic cache row and enqueues a create op in one go', async () => {
    db = createXpensesDb('test-mut-account-create')

    const row = await createAccount(db, { name: 'Cash', type: 'cash', startingBalance: 0 })

    const cached = await db.accounts.get(row.id)
    expect(cached).toMatchObject({ name: 'Cash', type: 'cash', balance: 0, deletedAt: null })
  })

  it('createAccount triggers a push that drains the outbox once the server confirms', async () => {
    db = createXpensesDb('test-mut-account-push')

    const row = await createAccount(db, { name: 'Cash', type: 'cash', startingBalance: 0 })

    await vi.waitFor(async () => {
      const pending = await db.outbox.toArray()
      expect(pending).toEqual([])
    })
    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe('/api/sync/push')
    const sentOps = JSON.parse(init?.body as string).ops
    expect(sentOps).toEqual([{ entity: 'accounts', action: 'create', payload: { id: row.id, name: 'Cash', type: 'cash', startingBalance: 0 } }])
  })

  it('updateAccount patches the cache row without needing the full record', async () => {
    db = createXpensesDb('test-mut-account-update')
    await db.accounts.put({ id: 'a1', name: 'Cash', type: 'cash', startingBalance: 0, balance: 0, sortOrder: 0, updatedAt: 'x', deletedAt: null })

    await updateAccount(db, 'a1', { name: 'Cash Wallet' })

    expect((await db.accounts.get('a1'))?.name).toBe('Cash Wallet')
  })

  it('deleteAccount marks the cache row deleted', async () => {
    db = createXpensesDb('test-mut-account-delete')
    await db.accounts.put({ id: 'a1', name: 'Cash', type: 'cash', startingBalance: 0, balance: 0, sortOrder: 0, updatedAt: 'x', deletedAt: null })

    await deleteAccount(db, 'a1')

    expect((await db.accounts.get('a1'))?.deletedAt).not.toBeNull()
  })

  it('createCategory writes cache row and sends only id/name/icon to the server', async () => {
    db = createXpensesDb('test-mut-category-create')

    const row = await createCategory(db, { name: 'Food', icon: null })

    await vi.waitFor(async () => expect(await db.outbox.toArray()).toEqual([]))
    const sentOps = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string).ops
    expect(sentOps).toEqual([{ entity: 'categories', action: 'create', payload: { id: row.id, name: 'Food', icon: null } }])
  })

  it('createTransaction sends the full transaction body, not a partial patch', async () => {
    db = createXpensesDb('test-mut-txn-create')

    const row = await createTransaction(db, {
      type: 'expense',
      amount: 5000,
      note: 'coffee',
      categoryId: 'c1',
      accountId: 'a1',
      fromAccountId: null,
      toAccountId: null,
      txnDate: '2026-07-10',
    })

    await vi.waitFor(async () => expect(await db.outbox.toArray()).toEqual([]))
    const sentOps = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string).ops
    expect(sentOps[0].payload).toMatchObject({
      id: row.id,
      type: 'expense',
      amount: 5000,
      categoryId: 'c1',
      accountId: 'a1',
      txnDate: '2026-07-10',
    })
    expect(sentOps[0].payload.updatedAt).toBeTruthy()
  })

  it('updateTransaction re-sends the full merged transaction (server upsert requires the whole object)', async () => {
    db = createXpensesDb('test-mut-txn-update')
    const created = await createTransaction(db, {
      type: 'expense',
      amount: 5000,
      note: 'coffee',
      categoryId: 'c1',
      accountId: 'a1',
      fromAccountId: null,
      toAccountId: null,
      txnDate: '2026-07-10',
    })
    await vi.waitFor(async () => expect(await db.outbox.toArray()).toEqual([]))
    vi.mocked(fetch).mockClear()

    await updateTransaction(db, created.id, { amount: 7500 })

    await vi.waitFor(async () => expect(await db.outbox.toArray()).toEqual([]))
    const sentOps = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string).ops
    expect(sentOps[0].payload).toMatchObject({ id: created.id, amount: 7500, note: 'coffee', categoryId: 'c1' })
  })

  it('two concurrent updateTransaction calls on the same row both apply (no lost-update race)', async () => {
    db = createXpensesDb('test-mut-txn-concurrent-update')
    const created = await createTransaction(db, {
      type: 'expense',
      amount: 5000,
      note: 'coffee',
      categoryId: 'c1',
      accountId: 'a1',
      fromAccountId: null,
      toAccountId: null,
      txnDate: '2026-07-10',
    })
    await vi.waitFor(async () => expect(await db.outbox.toArray()).toEqual([]))

    // Two edits racing (e.g. two open tabs) — a read-outside-transaction bug
    // would let one clobber the other's field back to the stale value.
    await Promise.all([
      updateTransaction(db, created.id, { amount: 9000 }),
      updateTransaction(db, created.id, { note: 'Dinner' }),
    ])

    const final = await db.transactions.get(created.id)
    expect(final).toMatchObject({ amount: 9000, note: 'Dinner' })
  })

  it('deleteTransaction sends id + updatedAt (LWW-guarded delete contract)', async () => {
    db = createXpensesDb('test-mut-txn-delete')
    const created = await createTransaction(db, {
      type: 'expense',
      amount: 5000,
      note: null,
      categoryId: 'c1',
      accountId: 'a1',
      fromAccountId: null,
      toAccountId: null,
      txnDate: '2026-07-10',
    })
    await vi.waitFor(async () => expect(await db.outbox.toArray()).toEqual([]))
    vi.mocked(fetch).mockClear()

    await deleteTransaction(db, created.id)

    await vi.waitFor(async () => expect(await db.outbox.toArray()).toEqual([]))
    const sentOps = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string).ops
    expect(sentOps).toEqual([{ entity: 'transactions', action: 'delete', payload: { id: created.id, updatedAt: expect.any(String) } }])
  })

  it('createBudget sends id/categoryId/limitAmount only', async () => {
    db = createXpensesDb('test-mut-budget-create')

    const row = await createBudget(db, { categoryId: 'c1', limitAmount: 60000 })

    await vi.waitFor(async () => expect(await db.outbox.toArray()).toEqual([]))
    const sentOps = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string).ops
    expect(sentOps).toEqual([{ entity: 'budgets', action: 'create', payload: { id: row.id, categoryId: 'c1', limitAmount: 60000 } }])
  })

  it('createRecurringRule writes a cached rule with active true by default', async () => {
    db = createXpensesDb('test-mut-recurring-create')

    const row = await createRecurringRule(db, {
      type: 'expense',
      amount: 5000,
      note: null,
      categoryId: 'c1',
      accountId: 'a1',
      fromAccountId: null,
      toAccountId: null,
      intervalUnit: 'month',
      intervalCount: 1,
      nextRunDate: '2026-08-01',
    })

    const cached = await db.recurringRules.get(row.id)
    expect(cached).toMatchObject({ active: true, intervalUnit: 'month', nextRunDate: '2026-08-01' })
  })
})
