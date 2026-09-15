'use strict'

const { rowToCamel } = require('../../lib/caseMap')

// Balance formula — see docs/SCHEMA.md "Balance Query (per account)".
function computeBalance({ startingBalance, expenseOut, incomeIn, transferOut, transferIn }) {
  return startingBalance - expenseOut + incomeIn - transferOut + transferIn
}

function safeBalanceFromRow(row) {
  const balance = BigInt(row.starting_balance) - BigInt(row.expense_out)
    + BigInt(row.income_in) - BigInt(row.transfer_out) + BigInt(row.transfer_in)
  const max = BigInt(Number.MAX_SAFE_INTEGER)
  return balance > max || balance < -max ? null : Number(balance)
}

function mapAccountRow(row) {
  const {
    expense_out: expenseOut, income_in: incomeIn, transfer_out: transferOut,
    transfer_in: transferIn, pot_reserved: potReserved = 0, ...accountRow
  } = row
  const account = rowToCamel(accountRow)
  const balance = computeBalance({
    startingBalance: account.startingBalance,
    expenseOut: Number(expenseOut),
    incomeIn: Number(incomeIn),
    transferOut: Number(transferOut),
    transferIn: Number(transferIn),
  })
  return {
    ...account,
    // mysql2 returns SUM() results as DECIMAL strings, not numbers.
    balance,
    reserved: Number(potReserved),
    available: balance - Number(potReserved),
    balanceRevision: Number(account.balanceRevision ?? 0),
  }
}

module.exports = { computeBalance, safeBalanceFromRow, mapAccountRow }
