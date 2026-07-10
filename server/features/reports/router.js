'use strict'

const express = require('express')
const { z } = require('zod')
const { ok, ApiError } = require('../../lib/apiResponse')
const accountsRepo = require('../accounts/repo')
const { mapAccountRow } = require('../accounts/service')
const { computeNet } = require('./service')
const repo = require('./repo')

const monthQuerySchema = z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) })

function createReportsRouter(pool) {
  const router = express.Router()

  router.get('/category-spend', async (req, res, next) => {
    const parsed = monthQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      next(new ApiError('VALIDATION_ERROR', parsed.error.issues[0].message))
      return
    }

    try {
      const rows = await repo.categorySpend(pool, parsed.data.month)
      res.json(
        ok(
          rows.map((row) => ({
            categoryId: row.category_id,
            name: row.name,
            total: Number(row.total),
          })),
        ),
      )
    } catch (err) {
      next(err)
    }
  })

  router.get('/summary', async (req, res, next) => {
    const parsed = monthQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      next(new ApiError('VALIDATION_ERROR', parsed.error.issues[0].message))
      return
    }

    try {
      const [accountRows, totals] = await Promise.all([
        accountsRepo.findAllWithSums(pool),
        repo.monthlyTotals(pool, parsed.data.month),
      ])

      res.json(
        ok({
          accounts: accountRows.map(mapAccountRow),
          monthIncome: totals.income,
          monthExpense: totals.expense,
          monthNet: computeNet(totals.income, totals.expense),
        }),
      )
    } catch (err) {
      next(err)
    }
  })

  return router
}

module.exports = { createReportsRouter }
