'use strict'

const { randomUUID } = require('crypto')
const { getPool } = require('../../../db/pool')
const repo = require('../repo')
const { mapAccountRow } = require('../service')

const pool = getPool()

afterAll(async () => {
  await pool.end()
})

describe('accounts repo', () => {
  let accountId
  let otherAccountId

  beforeEach(async () => {
    accountId = randomUUID()
    otherAccountId = randomUUID()
    await repo.create(pool, { id: accountId, name: 'Test Wallet', type: 'cash', startingBalance: 5000, sortOrder: 99 })
    await repo.create(pool, { id: otherAccountId, name: 'Other Wallet', type: 'cash', startingBalance: 1000, sortOrder: 100 })
  })

  afterEach(async () => {
    await pool.query(
      'DELETE FROM transactions WHERE account_id IN (?, ?) OR from_account_id IN (?, ?) OR to_account_id IN (?, ?)',
      [accountId, otherAccountId, accountId, otherAccountId, accountId, otherAccountId],
    )
    await pool.query('DELETE FROM accounts WHERE id IN (?, ?)', [accountId, otherAccountId])
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

  it('findAllForSync includes active accounts', async () => {
    const rows = await repo.findAllForSync(pool)
    expect(rows.some((r) => r.id === accountId)).toBe(true)
  })

  it('findAllForSync includes soft-deleted rows (tombstones)', async () => {
    await repo.softDelete(pool, accountId)
    const rows = await repo.findAllForSync(pool)
    const row = rows.find((r) => r.id === accountId)
    expect(row).toBeDefined()
    expect(row.deleted_at).not.toBeNull()
  })

  // Regression: the sync query used to be a plain `SELECT *`, so rows
  // pulled via /api/sync had no expense/income/transfer sums and the
  // offline client's computed balance stayed permanently undefined
  // (rendered as "NaN") — findAllWithSums (used by GET /api/accounts) was
  // never affected, only the sync path was.
  it('findAllForSync includes the same activity-sum columns as findAllWithSums', async () => {
    const rows = await repo.findAllForSync(pool)
    const row = rows.find((r) => r.id === accountId)
    expect(row).toMatchObject({ expense_out: '0', income_in: '0', transfer_out: '0', transfer_in: '0' })
  })

  it('findAllForSync reflects real transaction activity in the sum columns', async () => {
    await pool.query(
      `INSERT INTO transactions (id, type, amount, account_id, txn_date, updated_at)
       VALUES (?, 'expense', 4200, ?, CURDATE(), NOW())`,
      [randomUUID(), accountId],
    )

    const rows = await repo.findAllForSync(pool)
    const row = rows.find((r) => r.id === accountId)
    expect(row.expense_out).toBe('4200')
  })

  it('findAllForSync refreshes both balances after a transfer', async () => {
    await pool.query(
      `INSERT INTO transactions (id, type, amount, from_account_id, to_account_id, txn_date, updated_at)
       VALUES (?, 'transfer', 400, ?, ?, CURDATE(), '2099-01-01 00:00:00')`,
      [randomUUID(), accountId, otherAccountId],
    )

    const accounts = (await repo.findAllForSync(pool)).map(mapAccountRow)
    const source = accounts.find((account) => account.id === accountId)
    const destination = accounts.find((account) => account.id === otherAccountId)

    expect(source.balance).toBe(4600)
    expect(destination.balance).toBe(1400)
  })
})
