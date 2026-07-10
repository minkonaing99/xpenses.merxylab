'use strict'

const express = require('express')
const { z } = require('zod')
const { ok, ApiError } = require('../../lib/apiResponse')
const { rowToCamel } = require('../../lib/caseMap')
const { toMysqlDatetime } = require('../../lib/mysqlDate')
const { mapAccountRow } = require('../accounts/service')
const accountsRepo = require('../accounts/repo')
const categoriesRepo = require('../categories/repo')
const txnRepo = require('../transactions/repo')
const budgetsRepo = require('../budgets/repo')
const recurringRepo = require('../recurring/repo')
const { applyOp } = require('./ops')

const sinceQuerySchema = z.object({ since: z.string().datetime() })

const pushSchema = z.object({
  ops: z
    .array(
      z.object({
        entity: z.enum(['accounts', 'categories', 'transactions', 'budgets', 'recurring']),
        action: z.enum(['create', 'update', 'delete']),
        payload: z.record(z.string(), z.any()),
      }),
    )
    .min(1),
})

function createSyncRouter(pool) {
  const router = express.Router()

  router.get('/', async (req, res, next) => {
    const parsed = sinceQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      next(new ApiError('VALIDATION_ERROR', parsed.error.issues[0].message))
      return
    }

    try {
      const since = toMysqlDatetime(parsed.data.since)
      const [accounts, categories, transactions, budgets, recurringRules] = await Promise.all([
        accountsRepo.findChangedSince(pool, since),
        categoriesRepo.findChangedSince(pool, since),
        txnRepo.findChangedSince(pool, since),
        budgetsRepo.findChangedSince(pool, since),
        recurringRepo.findChangedSince(pool, since),
      ])

      res.json(
        ok({
          accounts: accounts.map(mapAccountRow),
          categories: categories.map(rowToCamel),
          transactions: transactions.map(rowToCamel),
          budgets: budgets.map(rowToCamel),
          recurringRules: recurringRules.map((r) => ({ ...rowToCamel(r), active: Boolean(r.active) })),
        }),
      )
    } catch (err) {
      next(err)
    }
  })

  router.post('/push', async (req, res, next) => {
    const parsed = pushSchema.safeParse(req.body)
    if (!parsed.success) {
      next(new ApiError('VALIDATION_ERROR', parsed.error.issues[0].message))
      return
    }

    try {
      const results = []
      // Sequential, not parallel — ops from one outbox can depend on
      // execution order (e.g. an account create before a txn referencing it).
      for (const op of parsed.data.ops) {
        results.push(await applyOp(pool, op))
      }
      res.json(ok({ results }))
    } catch (err) {
      next(err)
    }
  })

  return router
}

module.exports = { createSyncRouter }
