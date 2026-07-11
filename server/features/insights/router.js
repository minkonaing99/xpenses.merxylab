'use strict'

const express = require('express')
const { z } = require('zod')
const { ok, ApiError } = require('../../lib/apiResponse')
const { todayInBangkok } = require('../../cron/dateUtil')
const recurringRepo = require('../recurring/repo')
const repo = require('./repo')
const {
  monthWindow,
  computeForecast,
  scheduledRemaining,
  flagBudgetBurn,
  flagCategoryVelocity,
} = require('./service')

const MONTHS_BACK = 3
const DUPLICATE_WINDOW_HOURS = 48

const querySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  asOf: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
})

function parseQuery(req, next) {
  const parsed = querySchema.safeParse(req.query)
  if (!parsed.success) {
    next(new ApiError('VALIDATION_ERROR', parsed.error.issues[0].message))
    return null
  }
  const { month, asOf } = parsed.data
  const today = asOf || todayInBangkok()
  return { month, today, window: monthWindow(month, today) }
}

// recurring_rules rows (snake_case, BIGINT amount as string) -> the shape the
// scheduling math expects.
function toRuleModel(row) {
  return {
    type: row.type,
    amount: Number(row.amount),
    intervalUnit: row.interval_unit,
    intervalCount: row.interval_count,
    nextRunDate: row.next_run_date,
  }
}

function createInsightsRouter(pool) {
  const router = express.Router()

  router.get('/forecast', async (req, res, next) => {
    const q = parseQuery(req, next)
    if (!q) return
    try {
      const [actuals, ruleRows] = await Promise.all([
        repo.actualsToDate(pool, q.month, q.window.throughDate),
        recurringRepo.findAll(pool),
      ])
      const sched = scheduledRemaining(ruleRows.map(toRuleModel), q.window.windowStart, q.window.monthEnd)
      const forecast = computeForecast({
        paidExpense: actuals.expense,
        paidIncome: actuals.income,
        discretionarySpent: actuals.discretionary,
        daysElapsed: q.window.daysElapsed,
        daysInMonth: q.window.daysInMonth,
        scheduledExpenseRemaining: sched.expense,
        scheduledIncomeRemaining: sched.income,
      })
      res.json(
        ok({
          month: q.month,
          daysInMonth: q.window.daysInMonth,
          daysElapsed: q.window.daysElapsed,
          paidIncome: actuals.income,
          paidExpense: actuals.expense,
          ...forecast,
        }),
      )
    } catch (err) {
      next(err)
    }
  })

  router.get('/anomalies', async (req, res, next) => {
    const q = parseQuery(req, next)
    if (!q) return
    try {
      const [history, budgets, dups] = await Promise.all([
        repo.categoryHistory(pool, q.month, q.window.throughDate, MONTHS_BACK),
        repo.budgetStatus(pool, q.month, q.window.throughDate),
        repo.duplicateCandidates(pool, q.month, DUPLICATE_WINDOW_HOURS),
      ])

      const velocity = flagCategoryVelocity(
        history.map((r) => ({
          categoryId: r.category_id,
          name: r.name,
          currentSpent: Number(r.current_spent),
          avg3mo: Number(r.prev_total) / MONTHS_BACK,
        })),
        { daysElapsed: q.window.daysElapsed, daysInMonth: q.window.daysInMonth },
      )

      const burn = flagBudgetBurn(
        budgets.map((r) => ({
          categoryId: r.category_id,
          name: r.name,
          spent: Number(r.spent),
          limit: Number(r.limit),
        })),
        q.window.monthFraction,
      )

      const duplicates = dups.map((d) => ({
        type: 'duplicate',
        ids: [d.id1, d.id2],
        amount: Number(d.amount),
        name: d.category_name,
        note: d.note,
        txnDate: d.txn_date,
      }))

      res.json(ok([...burn, ...velocity, ...duplicates]))
    } catch (err) {
      next(err)
    }
  })

  router.get('/comparisons', async (req, res, next) => {
    const q = parseQuery(req, next)
    if (!q) return
    try {
      const rows = await repo.categoryComparison(pool, q.month, MONTHS_BACK)
      const data = rows
        .map((r) => {
          const current = Number(r.current_total)
          const last = Number(r.last_total)
          const prevAvg = Math.round(Number(r.prev_total) / MONTHS_BACK)
          return {
            categoryId: r.category_id,
            name: r.name,
            current,
            last,
            prevAvg,
            vsLast: current - last,
            vsAvg: current - prevAvg,
            trend: Math.sign(current - last),
          }
        })
        .filter((r) => r.current > 0 || r.last > 0 || r.prevAvg > 0)
      res.json(ok(data))
    } catch (err) {
      next(err)
    }
  })

  return router
}

module.exports = { createInsightsRouter }
