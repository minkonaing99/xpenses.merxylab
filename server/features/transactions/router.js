'use strict'

const express = require('express')
const { z } = require('zod')
const { ok, ApiError } = require('../../lib/apiResponse')
const { rowToCamel } = require('../../lib/caseMap')
const { writeEntity } = require('../entityWrites/writer')
const repo = require('./repo')

const TXN_TYPES = ['expense', 'income', 'transfer']

const listQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  type: z.enum(TXN_TYPES).optional(),
  accountId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().optional(),
  cursor: z.string().optional(),
})

function createTransactionsRouter(pool) {
  const router = express.Router()

  router.get('/', async (req, res, next) => {
    const parsed = listQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      next(new ApiError('VALIDATION_ERROR', parsed.error.issues[0].message))
      return
    }

    try {
      const { rows, nextCursor } = await repo.findAll(pool, parsed.data)
      res.json(ok(rows.map(rowToCamel), { nextCursor }))
    } catch (err) {
      next(err)
    }
  })

  router.get('/:id', async (req, res, next) => {
    try {
      const found = await repo.findById(pool, req.params.id)
      if (!found) {
        next(new ApiError('NOT_FOUND', 'transaction not found'))
        return
      }
      res.json(ok(rowToCamel(found)))
    } catch (err) {
      next(err)
    }
  })

  router.post('/', async (req, res, next) => {
    try {
      const result = await writeEntity(pool, {
        entity: 'transactions',
        action: 'create',
        payload: req.body,
      })
      const status = result.created ? 201 : 200
      res.status(status).json(ok(result.value, { syncStatus: result.status }))
    } catch (err) {
      next(err)
    }
  })

  router.patch('/:id', async (req, res, next) => {
    try {
      const result = await writeEntity(pool, {
        entity: 'transactions',
        action: 'update',
        id: req.params.id,
        payload: req.body,
      })
      res.json(ok(result.value, { syncStatus: result.status }))
    } catch (err) {
      next(err)
    }
  })

  router.delete('/:id', async (req, res, next) => {
    try {
      const result = await writeEntity(pool, {
        entity: 'transactions',
        action: 'delete',
        id: req.params.id,
        payload: req.body,
      })
      res.json(ok({}, { syncStatus: result.status }))
    } catch (err) {
      next(err)
    }
  })

  return router
}

module.exports = { createTransactionsRouter }
