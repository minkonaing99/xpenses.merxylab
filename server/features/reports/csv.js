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

// rows: joined transaction rows (snake_case) with category_name/account_name/
// from_account_name/to_account_name resolved by the repo.
function toCsv(rows) {
  const lines = [HEADERS.join(',')]
  for (const row of rows) {
    const fields = [
      row.txn_date,
      row.type,
      row.category_name ?? '',
      accountLabel(row),
      satangToBaht(row.amount),
      row.note ?? '',
    ]
    lines.push(fields.map(escapeField).join(','))
  }
  return lines.join('\r\n')
}

module.exports = { toCsv, escapeField, HEADERS }
