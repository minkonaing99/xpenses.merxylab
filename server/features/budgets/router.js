'use strict'

const express = require('express')
const { z } = require('zod')
const { ok, ApiError } = require('../../lib/apiResponse')
const { writeEntity } = require('../entityWrites/writer')
const { mapBudgetRow } = require('./service')
const repo = require('./repo')

const listQuerySchema = z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) })

function createBudgetsRouter(pool) {
  const router = express.Router()

  router.get('/', async (req, res, next) => {
    const parsed = listQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      next(new ApiError('VALIDATION_ERROR', parsed.error.issues[0].message))
      return
    }

    try {
      const rows = await repo.findAllWithSpent(pool, parsed.data.month)
      res.json(ok(rows.map(mapBudgetRow)))
    } catch (err) {
      next(err)
    }
  })

  router.post('/', async (req, res, next) => {
    try {
      const result = await writeEntity(pool, {
        entity: 'budgets',
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
        entity: 'budgets',
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
        entity: 'budgets',
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

module.exports = { createBudgetsRouter }
