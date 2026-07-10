'use strict'

const { rowToCamel } = require('../../lib/caseMap')

function computeOver(spent, limitAmount) {
  return spent > limitAmount
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

module.exports = { computeOver, mapBudgetRow }
