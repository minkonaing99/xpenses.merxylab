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

module.exports = { categorySpend, monthlyTotals }
