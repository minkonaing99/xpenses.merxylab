import type { XpensesDb, OutboxEntity, OutboxAction, OutboxOp } from './db'

export function enqueue(
  db: XpensesDb,
  entity: OutboxEntity,
  action: OutboxAction,
  payload: Record<string, unknown>,
): Promise<number> {
  return db.outbox.add({
    entity,
    action,
    payload,
    createdAt: new Date().toISOString(),
    status: 'pending',
  })
}

export function getPendingOps(db: XpensesDb): Promise<OutboxOp[]> {
  return db.outbox.where('status').equals('pending').sortBy('createdAt')
}

export async function markOpDone(db: XpensesDb, opId: number): Promise<void> {
  await db.outbox.delete(opId)
}

export async function markOpFailed(db: XpensesDb, opId: number): Promise<void> {
  await db.outbox.update(opId, { status: 'failed' })
}
