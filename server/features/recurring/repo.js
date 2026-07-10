'use strict'

const UPDATABLE_FIELDS = {
  type: 'type',
  amount: 'amount',
  note: 'note',
  categoryId: 'category_id',
  accountId: 'account_id',
  fromAccountId: 'from_account_id',
  toAccountId: 'to_account_id',
  intervalUnit: 'interval_unit',
  intervalCount: 'interval_count',
  nextRunDate: 'next_run_date',
  active: 'active',
}

async function findAll(pool) {
  const [rows] = await pool.query(
    'SELECT * FROM recurring_rules WHERE deleted_at IS NULL ORDER BY next_run_date, created_at',
  )
  return rows
}

async function findById(pool, id) {
  const [rows] = await pool.query('SELECT * FROM recurring_rules WHERE id = ? AND deleted_at IS NULL', [id])
  return rows[0] || null
}

// Rules due to fire on or before `today` — active only, not soft-deleted.
async function findDue(pool, today) {
  const [rows] = await pool.query(
    'SELECT * FROM recurring_rules WHERE deleted_at IS NULL AND active = 1 AND next_run_date <= ?',
    [today],
  )
  return rows
}

async function create(pool, rule) {
  await pool.query(
    `INSERT INTO recurring_rules
       (id, type, amount, note, category_id, account_id, from_account_id, to_account_id,
        interval_unit, interval_count, next_run_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      rule.id,
      rule.type,
      rule.amount,
      rule.note ?? null,
      rule.categoryId ?? null,
      rule.accountId ?? null,
      rule.fromAccountId ?? null,
      rule.toAccountId ?? null,
      rule.intervalUnit,
      rule.intervalCount ?? 1,
      rule.nextRunDate,
    ],
  )
}

async function update(pool, id, patch) {
  const columns = Object.keys(patch).filter((key) => key in UPDATABLE_FIELDS)
  if (columns.length === 0) return

  const setClause = columns.map((key) => `${UPDATABLE_FIELDS[key]} = ?`).join(', ')
  const values = columns.map((key) => (key === 'active' ? (patch[key] ? 1 : 0) : patch[key]))
  await pool.query(`UPDATE recurring_rules SET ${setClause} WHERE id = ? AND deleted_at IS NULL`, [...values, id])
}

async function softDelete(pool, id) {
  await pool.query('UPDATE recurring_rules SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL', [id])
}

// Includes soft-deleted rows (tombstones) — see docs/TECH.md §6 pull sync.
async function findChangedSince(pool, since) {
  const [rows] = await pool.query('SELECT * FROM recurring_rules WHERE updated_at > ?', [since])
  return rows
}

module.exports = { findAll, findById, findDue, create, update, softDelete, findChangedSince }
