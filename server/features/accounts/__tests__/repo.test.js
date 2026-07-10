'use strict'

const { randomUUID } = require('crypto')
const { getPool } = require('../../../db/pool')
const repo = require('../repo')

const pool = getPool()

afterAll(async () => {
  await pool.end()
})

describe('accounts repo', () => {
  let accountId

  beforeEach(async () => {
    accountId = randomUUID()
    await repo.create(pool, { id: accountId, name: 'Test Wallet', type: 'cash', startingBalance: 5000, sortOrder: 99 })
  })

  afterEach(async () => {
    await pool.query('DELETE FROM transactions WHERE account_id = ? OR from_account_id = ? OR to_account_id = ?', [
      accountId,
      accountId,
      accountId,
    ])
    await pool.query('DELETE FROM accounts WHERE id = ?', [accountId])
  })

  it('creates and finds an account by id', async () => {
    const found = await repo.findById(pool, accountId)
    expect(found).toMatchObject({ id: accountId, name: 'Test Wallet', type: 'cash', starting_balance: 5000 })
  })

  it('returns null for a non-existent id', async () => {
    expect(await repo.findById(pool, randomUUID())).toBeNull()
  })

  it('findAllWithSums includes the created account with zeroed activity sums', async () => {
    // Raw repo layer — mysql2 returns SUM() aggregates as DECIMAL strings;
    // service.mapAccountRow is responsible for numeric coercion, not repo.
    const rows = await repo.findAllWithSums(pool)
    const row = rows.find((r) => r.id === accountId)
    expect(row).toMatchObject({ expense_out: '0', income_in: '0', transfer_out: '0', transfer_in: '0' })
  })

  it('updates only the given fields', async () => {
    await repo.update(pool, accountId, { name: 'Renamed' })
    const found = await repo.findById(pool, accountId)
    expect(found.name).toBe('Renamed')
    expect(found.type).toBe('cash')
  })

  it('soft-deletes by setting deleted_at, excluding it from findById', async () => {
    await repo.softDelete(pool, accountId)
    expect(await repo.findById(pool, accountId)).toBeNull()
  })

  it('countReferences is 0 with no transactions, 1 after adding one', async () => {
    expect(await repo.countReferences(pool, accountId)).toBe(0)

    await pool.query(
      `INSERT INTO transactions (id, type, amount, account_id, txn_date, updated_at)
       VALUES (?, 'expense', 100, ?, CURDATE(), NOW())`,
      [randomUUID(), accountId],
    )

    expect(await repo.countReferences(pool, accountId)).toBe(1)
  })

  it('findChangedSince includes rows updated after the given timestamp', async () => {
    const rows = await repo.findChangedSince(pool, '2000-01-01 00:00:00')
    expect(rows.some((r) => r.id === accountId)).toBe(true)
  })

  it('findChangedSince excludes rows not touched since a future timestamp', async () => {
    const rows = await repo.findChangedSince(pool, '2099-01-01 00:00:00')
    expect(rows.some((r) => r.id === accountId)).toBe(false)
  })

  it('findChangedSince includes soft-deleted rows (tombstones)', async () => {
    await repo.softDelete(pool, accountId)
    const rows = await repo.findChangedSince(pool, '2000-01-01 00:00:00')
    const row = rows.find((r) => r.id === accountId)
    expect(row).toBeDefined()
    expect(row.deleted_at).not.toBeNull()
  })

  // Regression: findChangedSince used to be a plain `SELECT *`, so rows
  // pulled via /api/sync had no expense/income/transfer sums and the
  // offline client's computed balance stayed permanently undefined
  // (rendered as "NaN") — findAllWithSums (used by GET /api/accounts) was
  // never affected, only the sync path was.
  it('findChangedSince includes the same activity-sum columns as findAllWithSums', async () => {
    const rows = await repo.findChangedSince(pool, '2000-01-01 00:00:00')
    const row = rows.find((r) => r.id === accountId)
    expect(row).toMatchObject({ expense_out: '0', income_in: '0', transfer_out: '0', transfer_in: '0' })
  })

  it('findChangedSince reflects real transaction activity in the sum columns', async () => {
    await pool.query(
      `INSERT INTO transactions (id, type, amount, account_id, txn_date, updated_at)
       VALUES (?, 'expense', 4200, ?, CURDATE(), NOW())`,
      [randomUUID(), accountId],
    )

    const rows = await repo.findChangedSince(pool, '2000-01-01 00:00:00')
    const row = rows.find((r) => r.id === accountId)
    expect(row.expense_out).toBe('4200')
  })
})
