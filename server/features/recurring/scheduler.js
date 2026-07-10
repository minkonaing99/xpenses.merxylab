'use strict'

function pad2(n) {
  return String(n).padStart(2, '0')
}

function toDateStr(y, m, d) {
  return `${y}-${pad2(m + 1)}-${pad2(d)}`
}

// Advances a 'YYYY-MM-DD' date string by day/week/month * count. Month math
// is done on (year, month) pairs and clamps day-of-month to the target
// month's length (Jan 31 + 1 month = Feb 28, not "March 3" — the classic
// JS Date rollover pitfall) rather than delegating to Date's setMonth.
function addInterval(dateStr, unit, count) {
  const [y, m, d] = dateStr.split('-').map(Number)

  if (unit === 'day') {
    const date = new Date(Date.UTC(y, m - 1, d + count))
    return toDateStr(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  }

  if (unit === 'week') {
    return addInterval(dateStr, 'day', count * 7)
  }

  if (unit === 'month') {
    const totalMonths = y * 12 + (m - 1) + count
    const newYear = Math.floor(totalMonths / 12)
    const newMonth0 = ((totalMonths % 12) + 12) % 12
    const daysInNewMonth = new Date(Date.UTC(newYear, newMonth0 + 1, 0)).getUTCDate()
    const newDay = Math.min(d, daysInNewMonth)
    return toDateStr(newYear, newMonth0, newDay)
  }

  throw new Error(`unknown interval unit: ${unit}`)
}

// Pure — given one rule and today's date, returns every missed run_date
// (catch-up if cron didn't run for a while) plus the rule's new
// next_run_date. Does no I/O; the caller applies the writes.
function planDueRuns(rule, today) {
  const runDates = []
  let cursor = rule.nextRunDate

  while (cursor <= today) {
    runDates.push(cursor)
    cursor = addInterval(cursor, rule.intervalUnit, rule.intervalCount)
  }

  return { runDates, nextRunDate: cursor }
}

module.exports = { addInterval, planDueRuns }
