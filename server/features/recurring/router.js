'use strict'

const express = require('express')
const { z } = require('zod')
const { ok, ApiError } = require('../../lib/apiResponse')
const { rowToCamel } = require('../../lib/caseMap')
const { validateTransactionFields } = require('../transactions/service')
const { todayInBangkok } = require('../../cron/dateUtil')
const { addInterval, normalizeResumePatch, planUpcoming } = require('./scheduler')
const repo = require('./repo')

const upcomingSchema = z.object({ days: z.coerce.number().int().positive().max(365).default(30) })

const TXN_TYPES = ['expense', 'income', 'transfer']
const INTERVAL_UNITS = ['day', 'week', 'month']
const uuidOrNull = z.string().uuid().nullable().optional()

const createSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(TXN_TYPES),
  amount: z.number().int().positive(),
  note: z.string().max(255).optional(),
  categoryId: uuidOrNull,
  accountId: uuidOrNull,
  fromAccountId: uuidOrNull,
  toAccountId: uuidOrNull,
  intervalUnit: z.enum(INTERVAL_UNITS),
  intervalCount: z.number().int().positive().optional(),
  nextRunDate: z.string().date(),
})

const updateSchema = z
  .object({
    amount: z.number().int().positive().optional(),
    note: z.string().max(255).optional(),
    categoryId: uuidOrNull,
    accountId: uuidOrNull,
    fromAccountId: uuidOrNull,
    toAccountId: uuidOrNull,
    intervalUnit: z.enum(INTERVAL_UNITS).optional(),
    intervalCount: z.number().int().positive().optional(),
    nextRunDate: z.string().date().optional(),
    active: z.boolean().optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0, { message: 'at least one field is required' })

function createRecurringRouter(pool) {
  const router = express.Router()

  router.get('/', async (req, res, next) => {
    try {
      const rows = await repo.findAll(pool)
      res.json(ok(rows.map((row) => ({ ...rowToCamel(row), active: Boolean(row.active) }))))
    } catch (err) {
      next(err)
    }
  })

  // Projected occurrences of active rules within the next `days` (default 30).
  // Read-only: does not insert transactions — that stays the cron's job.
  router.get('/upcoming', async (req, res, next) => {
    const parsed = upcomingSchema.safeParse(req.query)
    if (!parsed.success) {
      next(new ApiError('VALIDATION_ERROR', parsed.error.issues[0].message))
      return
    }

    try {
      const today = todayInBangkok()
      const horizon = addInterval(today, 'day', parsed.data.days)
      const rows = await repo.findAll(pool)
      const rules = rows.filter((row) => row.active === 1).map((row) => ({ ...rowToCamel(row), active: true }))
      res.json(ok(planUpcoming(rules, today, horizon)))
    } catch (err) {
      next(err)
    }
  })

  router.post('/', async (req, res, next) => {
    const parsed = createSchema.safeParse(req.body)
    if (!parsed.success) {
      next(new ApiError('VALIDATION_ERROR', parsed.error.issues[0].message))
      return
    }

    const fieldError = validateTransactionFields(parsed.data)
    if (fieldError) {
      next(new ApiError('VALIDATION_ERROR', fieldError))
      return
    }

    try {
      await repo.create(pool, parsed.data)
      const created = await repo.findById(pool, parsed.data.id)
      res.status(201).json(ok({ ...rowToCamel(created), active: Boolean(created.active) }))
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        next(new ApiError('CONFLICT', 'recurring rule already exists'))
        return
      }
      next(err)
    }
  })

  router.patch('/:id', async (req, res, next) => {
    const parsed = updateSchema.safeParse(req.body)
    if (!parsed.success) {
      next(new ApiError('VALIDATION_ERROR', parsed.error.issues[0].message))
      return
    }

    try {
      const existing = await repo.findById(pool, req.params.id)
      if (!existing) {
        next(new ApiError('NOT_FOUND', 'recurring rule not found'))
        return
      }

      const existingRule = { ...rowToCamel(existing), active: Boolean(existing.active) }
      const patch = normalizeResumePatch(existingRule, parsed.data, todayInBangkok())
      const merged = { ...existingRule, ...patch }
      const fieldError = validateTransactionFields(merged)
      if (fieldError) {
        next(new ApiError('VALIDATION_ERROR', fieldError))
        return
      }

      await repo.update(pool, req.params.id, patch)
      const updated = await repo.findById(pool, req.params.id)
      res.json(ok({ ...rowToCamel(updated), active: Boolean(updated.active) }))
    } catch (err) {
      next(err)
    }
  })

  router.delete('/:id', async (req, res, next) => {
    try {
      const existing = await repo.findById(pool, req.params.id)
      if (!existing) {
        next(new ApiError('NOT_FOUND', 'recurring rule not found'))
        return
      }

      await repo.softDelete(pool, req.params.id)
      res.json(ok({}))
    } catch (err) {
      next(err)
    }
  })

  return router
}

module.exports = { createRecurringRouter, createSchema, updateSchema }
