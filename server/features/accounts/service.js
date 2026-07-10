'use strict'

const { rowToCamel } = require('../../lib/caseMap')

// Balance formula — see docs/SCHEMA.md "Balance Query (per account)".
function computeBalance({ startingBalance, expenseOut, incomeIn, transferOut, transferIn }) {
  return startingBalance - expenseOut + incomeIn - transferOut + transferIn
}

function mapAccountRow(row) {
  const { expense_out: expenseOut, income_in: incomeIn, transfer_out: transferOut, transfer_in: transferIn, ...accountRow } = row
  const account = rowToCamel(accountRow)
  return {
    ...account,
    // mysql2 returns SUM() results as DECIMAL strings, not numbers.
    balance: computeBalance({
      startingBalance: account.startingBalance,
      expenseOut: Number(expenseOut),
      incomeIn: Number(incomeIn),
      transferOut: Number(transferOut),
      transferIn: Number(transferIn),
    }),
  }
}

module.exports = { computeBalance, mapAccountRow }
