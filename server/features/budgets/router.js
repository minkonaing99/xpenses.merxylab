'use strict'

const express = require('express')
const { z } = require('zod')
const { ok, ApiError } = require('../../lib/apiResponse')
const { rowToCamel } = require('../../lib/caseMap')
const { mapBudgetRow } = require('./service')
const repo = require('./repo')

function currentMonth() {
  return new Date().toISOString().slice(0, 7)
}

const createSchema = z.object({
  id: z.string().uuid(),
  categoryId: z.string().uuid(),
  limitAmount: z.number().int().positive(),
})

const updateSchema = z
  .object({ limitAmount: z.number().int().positive().optional() })
  .refine((patch) => Object.keys(patch).length > 0, { message: 'at least one field is required' })

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
    const parsed = createSchema.safeParse(req.body)
    if (!parsed.success) {
      next(new ApiError('VALIDATION_ERROR', parsed.error.issues[0].message))
      return
    }

    try {
      const conflict = await repo.findActiveByCategoryId(pool, parsed.data.categoryId)
      if (conflict) {
        next(new ApiError('CONFLICT', 'a budget already exists for this category'))
        return
      }

      await repo.create(pool, parsed.data)
      const created = await repo.findByIdWithSpent(pool, parsed.data.id, currentMonth())
      res.status(201).json(ok(mapBudgetRow(created)))
    } catch (err) {
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
        next(new ApiError('NOT_FOUND', 'budget not found'))
        return
      }

      await repo.update(pool, req.params.id, parsed.data)
      const updated = await repo.findById(pool, req.params.id)
      res.json(ok(rowToCamel(updated)))
    } catch (err) {
      next(err)
    }
  })

  router.delete('/:id', async (req, res, next) => {
    try {
      const existing = await repo.findById(pool, req.params.id)
      if (!existing) {
        next(new ApiError('NOT_FOUND', 'budget not found'))
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

module.exports = { createBudgetsRouter }
