'use strict'

const { monthRange } = require('../../lib/dateRange')

async function categorySpend(pool, month) {
  const { start, end } = monthRange(month)
  const [rows] = await pool.query(
    `SELECT c.id AS category_id, c.name, SUM(t.amount) AS total
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     WHERE t.type = 'expense' AND t.deleted_at IS NULL AND t.txn_date >= ? AND t.txn_date < ?
     GROUP BY c.id, c.name
     ORDER BY total DESC`,
    [start, end],
  )
  return rows
}

// Flat month export: every non-deleted txn with category + account names
// resolved, oldest first (natural reading order for a statement/export).
async function monthTransactions(pool, month) {
  const { start, end } = monthRange(month)
  const [rows] = await pool.query(
    `SELECT t.txn_date, t.type, t.amount, t.note,
            c.name AS category_name,
            a.name AS account_name,
            fa.name AS from_account_name,
            ta.name AS to_account_name
     FROM transactions t
     LEFT JOIN categories c ON c.id = t.category_id
     LEFT JOIN accounts a ON a.id = t.account_id
     LEFT JOIN accounts fa ON fa.id = t.from_account_id
     LEFT JOIN accounts ta ON ta.id = t.to_account_id
     WHERE t.deleted_at IS NULL AND t.txn_date >= ? AND t.txn_date < ?
     ORDER BY t.txn_date ASC, t.created_at ASC`,
    [start, end],
  )
  return rows
}

async function monthlyTotals(pool, month) {
  const { start, end } = monthRange(month)
  const [rows] = await pool.query(
    `SELECT type, SUM(amount) AS total FROM transactions
     WHERE deleted_at IS NULL AND type IN ('income', 'expense') AND txn_date >= ? AND txn_date < ?
     GROUP BY type`,
    [start, end],
  )

  const byType = Object.fromEntries(rows.map((r) => [r.type, Number(r.total)]))
  return { income: byType.income ?? 0, expense: byType.expense ?? 0 }
}

module.exports = { categorySpend, monthTransactions, monthlyTotals }
