'use strict'

// [start, end) calendar-month bounds as DATE strings — used for txn_date
// range filters. Half-open so callers use `>= start AND < end`.
function monthRange(month) {
  const [year, mon] = month.split('-').map(Number)
  const start = `${month}-01`
  const nextMonth = mon === 12 ? `${year + 1}-01` : `${year}-${String(mon + 1).padStart(2, '0')}`
  return { start, end: `${nextMonth}-01` }
}

module.exports = { monthRange }
