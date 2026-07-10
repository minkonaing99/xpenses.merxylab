import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createXpensesDb, type XpensesDb } from './db'
import { enqueue } from './outbox'
import { pull, push, shouldApplyToCache } from './sync'

describe('shouldApplyToCache', () => {
  it('applies when there is no existing cached row', () => {
    expect(shouldApplyToCache('2026-07-10 09:00:00', undefined)).toBe(true)
  })

  it('applies when the incoming row is newer than or equal to the cached row', () => {
    expect(shouldApplyToCache('2026-07-10 09:00:00', '2026-07-10 08:00:00')).toBe(true)
    expect(shouldApplyToCache('2026-07-10 09:00:00', '2026-07-10 09:00:00')).toBe(true)
  })

  it('rejects when the incoming row is older than the cached row', () => {
    expect(shouldApplyToCache('2026-07-10 08:00:00', '2026-07-10 09:00:00')).toBe(false)
  })
})

function emptyPullResponse() {
  return { accounts: [], categories: [], transactions: [], budgets: [], recurringRules: [] }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status })
}

describe('pull', () => {
  let db: XpensesDb

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(async () => {
    vi.unstubAllGlobals()
    await db?.delete()
  })

  it('merges a new account row into the empty cache', async () => {
    db = createXpensesDb('test-sync-pull-new')
    const account = {
      id: 'a1',
      name: 'Cash',
      type: 'cash',
      startingBalance: 0,
      balance: 0,
      sortOrder: 0,
      updatedAt: '2026-07-10 09:00:00',
      deletedAt: null,
    }
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ ok: true, data: { ...emptyPullResponse(), accounts: [account] } }),
    )

    await pull(db)

    expect(await db.accounts.get('a1')).toEqual(account)
  })

  it('does not clobber a locally-newer unsynced row with a stale server row', async () => {
    db = createXpensesDb('test-sync-pull-lww')
    await db.accounts.put({
      id: 'a1',
      name: 'Cash (local edit)',
      type: 'cash',
      startingBalance: 0,
      balance: 0,
      sortOrder: 0,
      updatedAt: '2026-07-10 10:00:00',
      deletedAt: null,
    })
    const staleFromServer = {
      id: 'a1',
      name: 'Cash (stale)',
      type: 'cash',
      startingBalance: 0,
      balance: 0,
      sortOrder: 0,
      updatedAt: '2026-07-10 09:00:00',
      deletedAt: null,
    }
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ ok: true, data: { ...emptyPullResponse(), accounts: [staleFromServer] } }),
    )

    await pull(db)

    expect((await db.accounts.get('a1'))?.name).toBe('Cash (local edit)')
  })

  it('applies a tombstone (deletedAt set) through the same merge path', async () => {
    db = createXpensesDb('test-sync-pull-tombstone')
    await db.categories.put({
      id: 'c1',
      name: 'Food',
      icon: null,
      sortOrder: 0,
      updatedAt: '2026-07-10 09:00:00',
      deletedAt: null,
    })
    const tombstone = {
      id: 'c1',
      name: 'Food',
      icon: null,
      sortOrder: 0,
      updatedAt: '2026-07-10 10:00:00',
      deletedAt: '2026-07-10 10:00:00',
    }
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ ok: true, data: { ...emptyPullResponse(), categories: [tombstone] } }),
    )

    await pull(db)

    expect((await db.categories.get('c1'))?.deletedAt).toBe('2026-07-10 10:00:00')
  })

  it('advances lastSyncedAt to the max updatedAt among merged rows, converted to ISO', async () => {
    db = createXpensesDb('test-sync-pull-cursor')
    const account = {
      id: 'a1',
      name: 'Cash',
      type: 'cash',
      startingBalance: 0,
      balance: 0,
      sortOrder: 0,
      updatedAt: '2026-07-10 09:00:00',
      deletedAt: null,
    }
    const category = {
      id: 'c1',
      name: 'Food',
      icon: null,
      sortOrder: 0,
      updatedAt: '2026-07-10 11:30:00',
      deletedAt: null,
    }
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ ok: true, data: { ...emptyPullResponse(), accounts: [account], categories: [category] } }),
    )

    await pull(db)

    expect(await db.meta.get('lastSyncedAt')).toEqual({ key: 'lastSyncedAt', value: '2026-07-10T11:30:00Z' })
  })

  it('leaves lastSyncedAt unchanged when a pull returns no changed rows', async () => {
    db = createXpensesDb('test-sync-pull-cursor-noop')
    await db.meta.put({ key: 'lastSyncedAt', value: '2026-07-10T09:00:00Z' })
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ ok: true, data: emptyPullResponse() }))

    await pull(db)

    expect(await db.meta.get('lastSyncedAt')).toEqual({ key: 'lastSyncedAt', value: '2026-07-10T09:00:00Z' })
  })

  it('merges a tombstone for a row that does not exist locally yet', async () => {
    db = createXpensesDb('test-sync-pull-unknown-tombstone')
    const tombstone = {
      id: 'c-unknown',
      name: 'Deleted Elsewhere',
      icon: null,
      sortOrder: 0,
      updatedAt: '2026-07-10 09:00:00',
      deletedAt: '2026-07-10 09:00:00',
    }
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ ok: true, data: { ...emptyPullResponse(), categories: [tombstone] } }),
    )

    await pull(db)

    expect((await db.categories.get('c-unknown'))?.deletedAt).toBe('2026-07-10 09:00:00')
  })

  it('serializes two concurrent pulls so the cursor advances correctly, not just to whichever finishes last', async () => {
    db = createXpensesDb('test-sync-pull-concurrent')
    const first = {
      id: 'a1',
      name: 'First',
      type: 'cash',
      startingBalance: 0,
      balance: 0,
      sortOrder: 0,
      updatedAt: '2026-07-10 09:00:00',
      deletedAt: null,
    }
    const second = {
      id: 'a2',
      name: 'Second',
      type: 'cash',
      startingBalance: 0,
      balance: 0,
      sortOrder: 0,
      updatedAt: '2026-07-10 10:00:00',
      deletedAt: null,
    }
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ ok: true, data: { ...emptyPullResponse(), accounts: [first] } }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, data: { ...emptyPullResponse(), accounts: [second] } }))

    await Promise.all([pull(db), pull(db)])

    expect(await db.accounts.get('a1')).toBeDefined()
    expect(await db.accounts.get('a2')).toBeDefined()
    expect(await db.meta.get('lastSyncedAt')).toEqual({ key: 'lastSyncedAt', value: '2026-07-10T10:00:00Z' })
  })
})

describe('push', () => {
  let db: XpensesDb

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(async () => {
    vi.unstubAllGlobals()
    await db?.delete()
  })

  it('does nothing and makes no request when there are no pending ops', async () => {
    db = createXpensesDb('test-sync-push-empty')

    const results = await push(db)

    expect(results).toEqual([])
    expect(fetch).not.toHaveBeenCalled()
  })

  it('sends pending ops as a single batch to /api/sync/push', async () => {
    db = createXpensesDb('test-sync-push-batch')
    await enqueue(db, 'accounts', 'create', { id: 'a1', name: 'Cash' })
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ ok: true, data: { results: [{ id: 'a1', status: 'applied' }] } }),
    )

    await push(db)

    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe('/api/sync/push')
    expect(JSON.parse(init?.body as string)).toEqual({
      ops: [{ entity: 'accounts', action: 'create', payload: { id: 'a1', name: 'Cash' } }],
    })
  })

  it('removes an applied op from the outbox', async () => {
    db = createXpensesDb('test-sync-push-applied')
    const opId = await enqueue(db, 'accounts', 'create', { id: 'a1' })
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ ok: true, data: { results: [{ id: 'a1', status: 'applied' }] } }),
    )

    await push(db)

    expect(await db.outbox.get(opId)).toBeUndefined()
  })

  it('marks an errored op as failed and keeps it in the outbox', async () => {
    db = createXpensesDb('test-sync-push-error')
    const opId = await enqueue(db, 'accounts', 'create', { id: 'a1' })
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ ok: true, data: { results: [{ id: 'a1', status: 'error', code: 'VALIDATION_ERROR' }] } }),
    )

    await push(db)

    expect((await db.outbox.get(opId))?.status).toBe('failed')
  })

  it('removes a skipped op from the outbox (stale LWW write, resubmitting can never succeed)', async () => {
    db = createXpensesDb('test-sync-push-skipped')
    const opId = await enqueue(db, 'transactions', 'update', { id: 't1', amount: 100 })
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ ok: true, data: { results: [{ id: 't1', status: 'skipped' }] } }))

    await push(db)

    expect(await db.outbox.get(opId)).toBeUndefined()
  })

  it('resolves a mixed batch of applied/skipped/error results correctly per op', async () => {
    db = createXpensesDb('test-sync-push-mixed')
    const okId = await enqueue(db, 'accounts', 'create', { id: 'a1' })
    const skippedId = await enqueue(db, 'transactions', 'update', { id: 't1' })
    const errorId = await enqueue(db, 'categories', 'create', { id: 'c1' })
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({
        ok: true,
        data: {
          results: [
            { id: 'a1', status: 'applied' },
            { id: 't1', status: 'skipped' },
            { id: 'c1', status: 'error', code: 'VALIDATION_ERROR' },
          ],
        },
      }),
    )

    await push(db)

    expect(await db.outbox.get(okId)).toBeUndefined()
    expect(await db.outbox.get(skippedId)).toBeUndefined()
    expect((await db.outbox.get(errorId))?.status).toBe('failed')
  })

  it('throws and leaves every op pending when the results array length does not match the ops sent', async () => {
    db = createXpensesDb('test-sync-push-mismatch')
    const opId = await enqueue(db, 'accounts', 'create', { id: 'a1' })
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ ok: true, data: { results: [] } }))

    await expect(push(db)).rejects.toThrow(/result count mismatch/)
    expect((await db.outbox.get(opId))?.status).toBe('pending')
  })

  it('serializes two concurrent pushes so the same op is never sent twice', async () => {
    db = createXpensesDb('test-sync-push-concurrent')
    await enqueue(db, 'accounts', 'create', { id: 'a1' })
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ ok: true, data: { results: [{ id: 'a1', status: 'applied' }] } }),
    )

    await Promise.all([push(db), push(db)])

    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
