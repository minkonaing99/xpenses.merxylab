'use strict'

const { rowToCamel } = require('../../lib/caseMap')
const { todayInBangkok } = require('../../cron/dateUtil')

function computeOver(spent, limitAmount) {
  return spent >= limitAmount
}

function currentMonth(now = new Date()) {
  return todayInBangkok(now).slice(0, 7)
}

function mapBudgetRow(row) {
  const { spent, ...budgetRow } = row
  const budget = rowToCamel(budgetRow)
  const spentAmount = Number(spent)
  return {
    ...budget,
    spent: spentAmount,
    over: computeOver(spentAmount, budget.limitAmount),
  }
}

module.exports = { computeOver, currentMonth, mapBudgetRow }
