'use strict'

const express = require('express')
const { z } = require('zod')
const { ok, ApiError } = require('../../lib/apiResponse')
const { rowToCamel } = require('../../lib/caseMap')
const { writeEntity } = require('../entityWrites/writer')
const { todayInBangkok } = require('../../cron/dateUtil')
const { addInterval, planUpcoming } = require('./scheduler')
const repo = require('./repo')

// nextRunDate and active are excluded: the cron and pause/resume change them after creation.
const CREATE_FIELDS = ['type', 'amount', 'note', 'categoryId', 'accountId', 'fromAccountId', 'toAccountId', 'intervalUnit', 'intervalCount']

function mapRule(row) {
  return { ...rowToCamel(row), active: Boolean(row.active) }
}

function sameCreatedRule(current, candidate) {
  return CREATE_FIELDS.every((field) => (current[field] ?? null) === (candidate[field] ?? (field === 'intervalCount' ? 1 : null)))
}

const upcomingSchema = z.union([
  z.object({ days: z.coerce.number().int().positive().max(365).default(30) }),
  z.object({ from: z.string().date(), to: z.string().date() }).refine(({ from, to }) => from <= to, 'from must be before to'),
])

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
      const from = 'from' in parsed.data ? parsed.data.from : today
      const horizon = 'to' in parsed.data ? parsed.data.to : addInterval(today, 'day', parsed.data.days)
      const rows = await repo.findAll(pool)
      const rules = rows.filter((row) => row.active === 1).map((row) => ({ ...rowToCamel(row), active: true }))
      res.json(ok(planUpcoming(rules, from, horizon)))
    } catch (err) {
      next(err)
    }
  })

  router.post('/', async (req, res, next) => {
    try {
      const existing = typeof req.body?.id === 'string' ? await repo.findById(pool, req.body.id) : null
      if (existing) {
        const current = mapRule(existing)
        if (!sameCreatedRule(current, req.body)) throw new ApiError('CONFLICT', 'recurring rule id already used for different data')
        return res.json(ok(current))
      }
      const result = await writeEntity(pool, {
        entity: 'recurring',
        action: 'create',
        payload: req.body,
      })
      res.status(201).json(ok(result.value))
    } catch (err) {
      next(err)
    }
  })

  router.patch('/:id', async (req, res, next) => {
    try {
      const result = await writeEntity(pool, {
        entity: 'recurring',
        action: 'update',
        id: req.params.id,
        payload: req.body,
      })
      res.json(ok(result.value))
    } catch (err) {
      next(err)
    }
  })

  router.delete('/:id', async (req, res, next) => {
    try {
      await writeEntity(pool, {
        entity: 'recurring',
        action: 'delete',
        id: req.params.id,
        payload: req.body,
      })
      res.json(ok({}))
    } catch (err) {
      next(err)
    }
  })

  return router
}

module.exports = { createRecurringRouter }
