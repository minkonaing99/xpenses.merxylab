'use strict'

const { randomUUID } = require('crypto')
const { getPool } = require('../../../db/pool')
const accountsRepo = require('../../accounts/repo')
const categoriesRepo = require('../../categories/repo')
const repo = require('../repo')

const pool = getPool()

afterAll(async () => {
  await pool.end()
})

describe('transactions repo — LWW-guarded writes', () => {
  let accountId
  let categoryId
  let txnId

  beforeEach(async () => {
    accountId = randomUUID()
    categoryId = randomUUID()
    txnId = randomUUID()
    await accountsRepo.create(pool, { id: accountId, name: 'LWW Test Account' })
    await categoriesRepo.create(pool, { id: categoryId, name: `LWW Test Category ${categoryId}` })
  })

  afterEach(async () => {
    await pool.query('DELETE FROM transactions WHERE id = ?', [txnId])
    await pool.query('DELETE FROM accounts WHERE id = ?', [accountId])
    await pool.query('DELETE FROM categories WHERE id = ?', [categoryId])
  })

  function baseTxn(overrides = {}) {
    return {
      id: txnId,
      type: 'expense',
      amount: 1000,
      note: 'v1',
      categoryId,
      accountId,
      fromAccountId: null,
      toAccountId: null,
      txnDate: '2026-07-10',
      updatedAt: '2026-07-10 09:00:00',
      ...overrides,
    }
  }

  describe('upsert', () => {
    it('creates a new row and returns status "applied", created true', async () => {
      const result = await repo.upsert(pool, baseTxn())
      expect(result.status).toBe('applied')
      expect(result.created).toBe(true)
      expect(result.row.note).toBe('v1')
    })

    it('applies an update when incoming updatedAt is newer, created false', async () => {
      await repo.upsert(pool, baseTxn())
      const result = await repo.upsert(pool, baseTxn({ note: 'v2', updatedAt: '2026-07-10 10:00:00' }))
      expect(result.status).toBe('applied')
      expect(result.created).toBe(false)
      expect(result.row.note).toBe('v2')
    })

    it('skips an update when incoming updatedAt is older, keeping the stored row', async () => {
      await repo.upsert(pool, baseTxn({ note: 'v2', updatedAt: '2026-07-10 10:00:00' }))
      const result = await repo.upsert(pool, baseTxn({ note: 'stale', updatedAt: '2026-07-10 09:00:00' }))
      expect(result.status).toBe('skipped')
      expect(result.row.note).toBe('v2')
    })

    it('is idempotent for a byte-identical replay (same updatedAt applies, not an error)', async () => {
      await repo.upsert(pool, baseTxn())
      const result = await repo.upsert(pool, baseTxn())
      expect(result.status).toBe('applied')
      expect(result.row.note).toBe('v1')
    })
  })

  describe('updateGuarded', () => {
    it('applies a partial update when incoming updatedAt is newer', async () => {
      await repo.upsert(pool, baseTxn())
      const result = await repo.updateGuarded(pool, txnId, { note: 'patched', updatedAt: '2026-07-10 11:00:00' })
      expect(result.status).toBe('applied')
      expect(result.row.note).toBe('patched')
    })

    it('skips a partial update when incoming updatedAt is older', async () => {
      await repo.upsert(pool, baseTxn({ updatedAt: '2026-07-10 12:00:00' }))
      const result = await repo.updateGuarded(pool, txnId, { note: 'stale patch', updatedAt: '2026-07-10 09:00:00' })
      expect(result.status).toBe('skipped')
      expect(result.row.note).toBe('v1')
    })

    it('returns status "not_found" for an unknown id', async () => {
      const result = await repo.updateGuarded(pool, randomUUID(), { note: 'x', updatedAt: '2026-07-10 09:00:00' })
      expect(result.status).toBe('not_found')
    })
  })

  describe('softDeleteGuarded', () => {
    it('applies the delete when incoming updatedAt is newer, excluding it from findById', async () => {
      await repo.upsert(pool, baseTxn())
      const result = await repo.softDeleteGuarded(pool, txnId, '2026-07-10 12:00:00')
      expect(result.status).toBe('applied')
      expect(await repo.findById(pool, txnId)).toBeNull()
    })

    it('skips the delete when incoming updatedAt is older, leaving the row intact', async () => {
      await repo.upsert(pool, baseTxn({ updatedAt: '2026-07-10 12:00:00' }))
      const result = await repo.softDeleteGuarded(pool, txnId, '2026-07-10 09:00:00')
      expect(result.status).toBe('skipped')
      expect(await repo.findById(pool, txnId)).not.toBeNull()
    })

    it('returns status "not_found" for an unknown id', async () => {
      const result = await repo.softDeleteGuarded(pool, randomUUID(), '2026-07-10 09:00:00')
      expect(result.status).toBe('not_found')
    })
  })

  describe('findByIdAny', () => {
    it('finds a soft-deleted row (tombstone), unlike findById', async () => {
      await repo.upsert(pool, baseTxn())
      await repo.softDeleteGuarded(pool, txnId, '2026-07-10 12:00:00')

      expect(await repo.findById(pool, txnId)).toBeNull()
      const tombstone = await repo.findByIdAny(pool, txnId)
      expect(tombstone).not.toBeNull()
      expect(tombstone.deleted_at).not.toBeNull()
    })
  })
})
