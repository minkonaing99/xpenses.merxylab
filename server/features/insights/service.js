'use strict'

const { planDueRuns, addInterval } = require('../recurring/scheduler')

// Resolves a requested month against `today` (YYYY-MM-DD) into the bounds the
// forecast/anomaly math needs. `windowStart` is the exclusive lower bound for
// "recurring still to fire this month": today for the current month, before
// the month for a future month, after the month for a past one (=> none).
function monthWindow(month, today) {
  const [year, mon] = month.split('-').map(Number)
  const daysInMonth = new Date(Date.UTC(year, mon, 0)).getUTCDate()
  const monthStart = `${month}-01`
  const monthEnd = `${month}-${String(daysInMonth).padStart(2, '0')}`
  const currentMonth = today.slice(0, 7)

  let daysElapsed
  let throughDate
  if (month === currentMonth) {
    daysElapsed = Number(today.slice(8, 10))
    throughDate = today
  } else if (month < currentMonth) {
    daysElapsed = daysInMonth
    throughDate = monthEnd
  } else {
    daysElapsed = 0
    throughDate = monthEnd
  }

  const dayBeforeStart = addInterval(monthStart, 'day', -1)
  const windowStart = today > dayBeforeStart ? today : dayBeforeStart

  return { daysInMonth, daysElapsed, throughDate, monthEnd, windowStart, monthFraction: daysElapsed / daysInMonth }
}

// Recurring-aware month-end projection. Discretionary (non-recurring) spend
// is extrapolated at the current daily rate over the days left; recurring
// bills still due this month are added at their exact amounts (from the
// rules), not guessed. All values are integer satang.
function computeForecast({
  paidExpense,
  paidIncome,
  discretionarySpent,
  daysElapsed,
  daysInMonth,
  scheduledExpenseRemaining,
  scheduledIncomeRemaining,
}) {
  const daysRemaining = Math.max(0, daysInMonth - daysElapsed)
  const dailyBurnRate = daysElapsed > 0 ? discretionarySpent / daysElapsed : 0
  const projectedDiscretionary = Math.round(dailyBurnRate * daysRemaining)

  const projectedExpense = paidExpense + projectedDiscretionary + scheduledExpenseRemaining
  const projectedIncome = paidIncome + scheduledIncomeRemaining

  return {
    daysRemaining,
    dailyBurnRate,
    projectedExpense,
    projectedIncome,
    projectedNet: projectedIncome - projectedExpense,
  }
}

// How many more times a rule fires strictly after `today` and on/before
// `monthEnd`. Reuses the recurring scheduler so interval math (month-end
// clamping, week stepping) stays in one place.
function countRemainingOccurrences(rule, today, monthEnd) {
  const { runDates } = planDueRuns(
    { intervalUnit: rule.intervalUnit, intervalCount: rule.intervalCount, nextRunDate: rule.nextRunDate },
    monthEnd,
  )
  return runDates.filter((d) => d > today && d <= monthEnd).length
}

function scheduledRemaining(rules, today, monthEnd) {
  return rules.reduce(
    (acc, rule) => {
      if (rule.type !== 'expense' && rule.type !== 'income') return acc
      const occurrences = countRemainingOccurrences(rule, today, monthEnd)
      acc[rule.type] += rule.amount * occurrences
      return acc
    },
    { expense: 0, income: 0 },
  )
}

// Category is >= 80% through its budget while < 80% of the month has passed:
// on pace to blow the budget early.
function flagBudgetBurn(budgets, monthFraction) {
  if (monthFraction >= 0.8) return []
  return budgets
    .filter((b) => b.limit > 0 && b.spent / b.limit >= 0.8)
    .map((b) => ({
      type: 'budget_burn',
      categoryId: b.categoryId,
      name: b.name,
      spent: b.spent,
      limit: b.limit,
      pct: b.spent / b.limit,
    }))
}

// Category whose spend, projected to the full month at the current rate,
// runs to >= `multiple` x its trailing 3-month average. Skips categories
// below the spend floor (noise) and those with no history (no baseline).
function flagCategoryVelocity(categories, { daysElapsed, daysInMonth, multiple = 2, minSpent = 50000 }) {
  return categories
    .map((c) => {
      const projectedFull =
        daysElapsed > 0 ? Math.round((c.currentSpent / daysElapsed) * daysInMonth) : c.currentSpent
      return { ...c, projectedFull }
    })
    .filter((c) => c.avg3mo > 0 && c.currentSpent >= minSpent && c.projectedFull >= multiple * c.avg3mo)
    .map((c) => ({
      type: 'category_velocity',
      categoryId: c.categoryId,
      name: c.name,
      currentSpent: c.currentSpent,
      avg3mo: c.avg3mo,
      projectedFull: c.projectedFull,
    }))
}

module.exports = {
  monthWindow,
  computeForecast,
  countRemainingOccurrences,
  scheduledRemaining,
  flagBudgetBurn,
  flagCategoryVelocity,
}
