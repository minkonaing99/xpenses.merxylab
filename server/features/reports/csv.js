'use strict'

// Pure CSV builder for a month's transactions. Money in satang -> baht string
// (2dp) for spreadsheet/tax use. RFC4180 quoting.

const HEADERS = ['date', 'type', 'category', 'account', 'amount_thb', 'note']

function satangToBaht(satang) {
  return (Number(satang) / 100).toFixed(2)
}

// Wrap in quotes only when the field contains a comma, quote, or newline;
// escape embedded quotes by doubling them. Neutralize spreadsheet formula
// injection by prefixing a `'` when a field starts with =, +, -, @, tab, or CR
// (amounts are always positive satang, so the numeric column never triggers it).
function escapeField(value) {
  const s = value == null ? '' : String(value)
  const guarded = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
  if (/[",\n\r]/.test(guarded)) return `"${guarded.replace(/"/g, '""')}"`
  return guarded
}

function accountLabel(row) {
  if (row.type === 'transfer') {
    return `${row.from_account_name ?? '?'} -> ${row.to_account_name ?? '?'}`
  }
  return row.account_name ?? ''
}

// One joined transaction row (snake_case) -> the flat export record, keyed by
// HEADERS. Money as baht string (2dp). Shared by CSV and JSON export.
function toRecord(row) {
  return {
    date: row.txn_date,
    type: row.type,
    category: row.category_name ?? '',
    account: accountLabel(row),
    amount_thb: satangToBaht(row.amount),
    note: row.note ?? '',
  }
}

// rows: joined transaction rows (snake_case) with category_name/account_name/
// from_account_name/to_account_name resolved by the repo.
function toCsv(rows) {
  const lines = [HEADERS.join(',')]
  for (const row of rows) {
    const rec = toRecord(row)
    lines.push(HEADERS.map((h) => escapeField(rec[h])).join(','))
  }
  return lines.join('\r\n')
}

function toJson(rows) {
  return JSON.stringify(rows.map(toRecord), null, 2)
}

module.exports = { toCsv, toJson, toRecord, escapeField, HEADERS }
