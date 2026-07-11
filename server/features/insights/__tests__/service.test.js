'use strict'

const {
  computeForecast,
  countRemainingOccurrences,
  scheduledRemaining,
  flagBudgetBurn,
  flagCategoryVelocity,
  monthWindow,
} = require('../service')

describe('monthWindow', () => {
  it('for the current month, elapsed days come from today and the remaining window starts today', () => {
    const w = monthWindow('2026-07', '2026-07-10')
    expect(w.daysInMonth).toBe(31)
    expect(w.daysElapsed).toBe(10)
    expect(w.throughDate).toBe('2026-07-10')
    expect(w.monthEnd).toBe('2026-07-31')
    expect(w.windowStart).toBe('2026-07-10')
    expect(w.monthFraction).toBeCloseTo(10 / 31)
  })

  it('for a past month, the whole month is elapsed and nothing remains', () => {
    const w = monthWindow('2026-05', '2026-07-10')
    expect(w.daysElapsed).toBe(31)
    expect(w.throughDate).toBe('2026-05-31')
    // windowStart is after monthEnd -> no future occurrences counted
    expect(w.windowStart > w.monthEnd).toBe(true)
  })

  it('for a future month, zero elapsed and the full month remains', () => {
    const w = monthWindow('2026-09', '2026-07-10')
    expect(w.daysElapsed).toBe(0)
    expect(w.windowStart < '2026-09-01').toBe(true)
    expect(w.monthEnd).toBe('2026-09-30')
  })
})

describe('insights service', () => {
  describe('computeForecast', () => {
    it('projects discretionary burn over the days remaining and adds scheduled recurring', () => {
      // 10 days into a 30-day month. Discretionary 30000 satang so far -> 3000/day.
      // 20 days remain -> +60000 projected discretionary. Plus a 15000 bill still due.
      const f = computeForecast({
        paidExpense: 50000,
        paidIncome: 200000,
        discretionarySpent: 30000,
        daysElapsed: 10,
        daysInMonth: 30,
        scheduledExpenseRemaining: 15000,
        scheduledIncomeRemaining: 0,
      })
      expect(f.daysRemaining).toBe(20)
      expect(f.projectedExpense).toBe(50000 + 60000 + 15000)
      expect(f.projectedIncome).toBe(200000)
      expect(f.projectedNet).toBe(200000 - 125000)
    })

    it('returns actuals when the month is already complete (no days remaining)', () => {
      const f = computeForecast({
        paidExpense: 90000,
        paidIncome: 200000,
        discretionarySpent: 40000,
        daysElapsed: 31,
        daysInMonth: 31,
        scheduledExpenseRemaining: 0,
        scheduledIncomeRemaining: 0,
      })
      expect(f.daysRemaining).toBe(0)
      expect(f.projectedExpense).toBe(90000)
      expect(f.projectedNet).toBe(200000 - 90000)
    })

    it('does not divide by zero on day 0 of the month', () => {
      const f = computeForecast({
        paidExpense: 0,
        paidIncome: 0,
        discretionarySpent: 0,
        daysElapsed: 0,
        daysInMonth: 30,
        scheduledExpenseRemaining: 25000,
        scheduledIncomeRemaining: 0,
      })
      expect(f.dailyBurnRate).toBe(0)
      expect(f.projectedExpense).toBe(25000)
    })
  })

  describe('countRemainingOccurrences', () => {
    const monthEnd = '2026-07-31'

    it('counts a monthly rule firing once more this month', () => {
      const rule = { intervalUnit: 'month', intervalCount: 1, nextRunDate: '2026-07-25' }
      expect(countRemainingOccurrences(rule, '2026-07-10', monthEnd)).toBe(1)
    })

    it('counts every occurrence of a weekly rule between today and month end', () => {
      const rule = { intervalUnit: 'week', intervalCount: 1, nextRunDate: '2026-07-11' }
      // 07-11, 07-18, 07-25 fall after 07-10 and on/before 07-31 -> 3
      expect(countRemainingOccurrences(rule, '2026-07-10', monthEnd)).toBe(3)
    })

    it('ignores occurrences that already fired (on or before today)', () => {
      const rule = { intervalUnit: 'week', intervalCount: 1, nextRunDate: '2026-07-04' }
      // 07-04, 07-11 are <= today(07-11); 07-18, 07-25 remain -> 2
      expect(countRemainingOccurrences(rule, '2026-07-11', monthEnd)).toBe(2)
    })

    it('returns 0 when the next run is in a later month', () => {
      const rule = { intervalUnit: 'month', intervalCount: 1, nextRunDate: '2026-08-05' }
      expect(countRemainingOccurrences(rule, '2026-07-10', monthEnd)).toBe(0)
    })
  })

  describe('scheduledRemaining', () => {
    it('sums remaining recurring amounts split by expense and income', () => {
      const rules = [
        { type: 'expense', amount: 15000, intervalUnit: 'month', intervalCount: 1, nextRunDate: '2026-07-25' },
        { type: 'income', amount: 200000, intervalUnit: 'month', intervalCount: 1, nextRunDate: '2026-07-28' },
        { type: 'expense', amount: 5000, intervalUnit: 'week', intervalCount: 1, nextRunDate: '2026-07-12' },
        { type: 'transfer', amount: 9999, intervalUnit: 'month', intervalCount: 1, nextRunDate: '2026-07-20' },
      ]
      // weekly expense fires 07-12,07-19,07-26 -> 3 x 5000 = 15000; monthly expense 1 x 15000
      const r = scheduledRemaining(rules, '2026-07-10', '2026-07-31')
      expect(r.expense).toBe(15000 + 15000)
      expect(r.income).toBe(200000)
    })
  })

  describe('flagBudgetBurn', () => {
    it('flags a category past 80% of its budget before 80% of the month elapsed', () => {
      const budgets = [
        { categoryId: 'a', name: 'Food', spent: 85000, limit: 100000 },
        { categoryId: 'b', name: 'Fuel', spent: 40000, limit: 100000 },
      ]
      const flags = flagBudgetBurn(budgets, 0.4)
      expect(flags).toHaveLength(1)
      expect(flags[0]).toMatchObject({ type: 'budget_burn', categoryId: 'a' })
    })

    it('does not flag once the month itself is 80% gone', () => {
      const budgets = [{ categoryId: 'a', name: 'Food', spent: 85000, limit: 100000 }]
      expect(flagBudgetBurn(budgets, 0.9)).toHaveLength(0)
    })

    it('ignores budgets with a non-positive limit', () => {
      const budgets = [{ categoryId: 'a', name: 'Food', spent: 5000, limit: 0 }]
      expect(flagBudgetBurn(budgets, 0.1)).toHaveLength(0)
    })
  })

  describe('flagCategoryVelocity', () => {
    const opts = { daysElapsed: 10, daysInMonth: 30, multiple: 2, minSpent: 50000 }

    it('flags a category whose projected month spend exceeds 2x its 3-month average', () => {
      // 60000 in 10 days -> projected 180000, avg 80000 -> 180000 >= 2*80000? no (160000). raise spend.
      const cats = [{ categoryId: 'a', name: 'Food', currentSpent: 90000, avg3mo: 80000 }]
      // projected 270000 >= 160000 and currentSpent 90000 >= 50000 -> flagged
      const flags = flagCategoryVelocity(cats, opts)
      expect(flags).toHaveLength(1)
      expect(flags[0]).toMatchObject({ type: 'category_velocity', categoryId: 'a', projectedFull: 270000 })
    })

    it('does not flag tiny categories below the minimum spend floor', () => {
      const cats = [{ categoryId: 'a', name: 'Snacks', currentSpent: 40000, avg3mo: 1000 }]
      expect(flagCategoryVelocity(cats, opts)).toHaveLength(0)
    })

    it('does not flag a category with no historical baseline', () => {
      const cats = [{ categoryId: 'a', name: 'New', currentSpent: 90000, avg3mo: 0 }]
      expect(flagCategoryVelocity(cats, opts)).toHaveLength(0)
    })
  })
})
