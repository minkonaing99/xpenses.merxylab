'use strict'

const { monthRange } = require('../../lib/dateRange')

const UPDATABLE_FIELDS = {
  limitAmount: 'limit_amount',
}

async function findById(pool, id) {
  const [rows] = await pool.query('SELECT * FROM budgets WHERE id = ? AND deleted_at IS NULL', [id])
  return rows[0] || null
}

async function findByIdAny(pool, id) {
  const [rows] = await pool.query('SELECT * FROM budgets WHERE id = ?', [id])
  return rows[0] || null
}

// Uniqueness among non-deleted budgets is enforced here, not by a DB
// constraint (see migration 004, mirrors categories' findActiveByName fix).
// Accepted TOCTOU: this check-then-create is not transactional, so two
// concurrent POSTs for the same category could both pass and create two
// active budgets. Not fixed — solo-user, single-session app (see
// docs/TECH.md §7 "solo-user assumption removes concurrent-merge
// complexity by design"); would need SELECT...FOR UPDATE or a generated-
// column unique index if this app ever supports concurrent writers.
async function findActiveByCategoryId(pool, categoryId, excludeId) {
  const [rows] = await pool.query(
    'SELECT id FROM budgets WHERE category_id = ? AND deleted_at IS NULL AND id != ?',
    [categoryId, excludeId ?? ''],
  )
  return rows[0] || null
}

const SPENT_JOIN_SQL = `
  SELECT b.*, COALESCE(spent.total, 0) AS spent
  FROM budgets b
  LEFT JOIN (
    SELECT category_id, SUM(amount) AS total FROM transactions
    WHERE type = 'expense' AND deleted_at IS NULL AND txn_date >= ? AND txn_date < ?
    GROUP BY category_id
  ) spent ON spent.category_id = b.category_id
  WHERE b.deleted_at IS NULL
`

async function findAllWithSpent(pool, month) {
  const { start, end } = monthRange(month)
  const [rows] = await pool.query(`${SPENT_JOIN_SQL} ORDER BY b.created_at`, [start, end])
  return rows
}

async function findByIdWithSpent(pool, id, month) {
  const { start, end } = monthRange(month)
  const [rows] = await pool.query(`${SPENT_JOIN_SQL} AND b.id = ?`, [start, end, id])
  return rows[0] || null
}

async function create(pool, { id, categoryId, limitAmount }) {
  await pool.query('INSERT INTO budgets (id, category_id, limit_amount) VALUES (?, ?, ?)', [
    id,
    categoryId,
    limitAmount,
  ])
}

async function update(pool, id, patch) {
  const columns = Object.keys(patch).filter((key) => key in UPDATABLE_FIELDS)
  if (columns.length === 0) return

  const setClause = columns.map((key) => `${UPDATABLE_FIELDS[key]} = ?`).join(', ')
  const values = columns.map((key) => patch[key])
  await pool.query(`UPDATE budgets SET ${setClause} WHERE id = ? AND deleted_at IS NULL`, [...values, id])
}

async function softDelete(pool, id) {
  await pool.query('UPDATE budgets SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL', [id])
}

// Includes soft-deleted rows (tombstones) — see docs/TECH.md §6 pull sync.
async function findChangedSince(pool, since) {
  const [rows] = await pool.query('SELECT * FROM budgets WHERE updated_at > ?', [since])
  return rows
}

module.exports = {
  findById,
  findByIdAny,
  findByIdWithSpent,
  findActiveByCategoryId,
  findAllWithSpent,
  create,
  update,
  softDelete,
  findChangedSince,
}
