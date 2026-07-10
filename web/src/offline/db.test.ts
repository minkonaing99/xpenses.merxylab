import { afterEach, describe, expect, it } from 'vitest'
import { createXpensesDb, type XpensesDb } from './db'

describe('XpensesDb', () => {
  let db: XpensesDb

  afterEach(async () => {
    await db?.delete()
  })

  it('stores and retrieves a cached account by id', async () => {
    db = createXpensesDb('test-db-accounts')
    await db.accounts.put({
      id: 'a1',
      name: 'Cash',
      type: 'cash',
      startingBalance: 0,
      balance: 0,
      sortOrder: 0,
      updatedAt: '2026-07-10 09:00:00',
      deletedAt: null,
    })

    const row = await db.accounts.get('a1')
    expect(row?.name).toBe('Cash')
  })

  it('enqueues an outbox op with an auto-incremented opId', async () => {
    db = createXpensesDb('test-db-outbox')
    const opId = await db.outbox.add({
      entity: 'accounts',
      action: 'create',
      payload: { id: 'a1' },
      createdAt: '2026-07-10T09:00:00.000Z',
      status: 'pending',
    })

    expect(opId).toBeGreaterThan(0)
  })

  it('lists outbox ops in FIFO order by createdAt', async () => {
    db = createXpensesDb('test-db-outbox-order')
    await db.outbox.add({
      entity: 'accounts',
      action: 'create',
      payload: { id: 'a2' },
      createdAt: '2026-07-10T09:05:00.000Z',
      status: 'pending',
    })
    await db.outbox.add({
      entity: 'accounts',
      action: 'create',
      payload: { id: 'a1' },
      createdAt: '2026-07-10T09:00:00.000Z',
      status: 'pending',
    })

    const ops = await db.outbox.orderBy('createdAt').toArray()
    expect(ops.map((op) => op.payload.id)).toEqual(['a1', 'a2'])
  })

  it('stores a meta key/value entry (lastSyncedAt cursor)', async () => {
    db = createXpensesDb('test-db-meta')
    await db.meta.put({ key: 'lastSyncedAt', value: '2026-07-10T09:00:00.000Z' })

    const entry = await db.meta.get('lastSyncedAt')
    expect(entry?.value).toBe('2026-07-10T09:00:00.000Z')
  })
})
