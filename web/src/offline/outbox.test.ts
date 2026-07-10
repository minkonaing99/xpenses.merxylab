import { afterEach, describe, expect, it } from 'vitest'
import { createXpensesDb, type XpensesDb } from './db'
import { enqueue, getPendingOps, markOpDone, markOpFailed } from './outbox'

describe('outbox', () => {
  let db: XpensesDb

  afterEach(async () => {
    await db?.delete()
  })

  it('enqueues a pending op and returns its opId', async () => {
    db = createXpensesDb('test-outbox-enqueue')
    const opId = await enqueue(db, 'accounts', 'create', { id: 'a1', name: 'Cash' })

    const stored = await db.outbox.get(opId)
    expect(stored).toMatchObject({ entity: 'accounts', action: 'create', status: 'pending' })
    expect(stored?.payload).toEqual({ id: 'a1', name: 'Cash' })
  })

  it('returns pending ops in FIFO order regardless of insertion order', async () => {
    db = createXpensesDb('test-outbox-fifo')
    const op2 = await enqueue(db, 'accounts', 'create', { id: 'a2' })
    await db.outbox.update(op2, { createdAt: '2026-07-10T09:05:00.000Z' })
    const op1 = await enqueue(db, 'accounts', 'create', { id: 'a1' })
    await db.outbox.update(op1, { createdAt: '2026-07-10T09:00:00.000Z' })

    const pending = await getPendingOps(db)
    expect(pending.map((op) => op.payload.id)).toEqual(['a1', 'a2'])
  })

  it('markOpDone removes the op from the outbox', async () => {
    db = createXpensesDb('test-outbox-done')
    const opId = await enqueue(db, 'accounts', 'create', { id: 'a1' })

    await markOpDone(db, opId)

    expect(await db.outbox.get(opId)).toBeUndefined()
    expect(await getPendingOps(db)).toEqual([])
  })

  it('markOpFailed keeps the op but excludes it from pending', async () => {
    db = createXpensesDb('test-outbox-failed')
    const opId = await enqueue(db, 'accounts', 'create', { id: 'a1' })

    await markOpFailed(db, opId)

    const stored = await db.outbox.get(opId)
    expect(stored?.status).toBe('failed')
    expect(await getPendingOps(db)).toEqual([])
  })
})
