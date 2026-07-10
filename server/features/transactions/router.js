'use strict'

const express = require('express')
const { z } = require('zod')
const { ok, ApiError } = require('../../lib/apiResponse')
const { rowToCamel } = require('../../lib/caseMap')
const { toMysqlDatetime } = require('../../lib/mysqlDate')
const { validateTransactionFields } = require('./service')
const repo = require('./repo')

const TXN_TYPES = ['expense', 'income', 'transfer']
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
  txnDate: z.string().date(),
  updatedAt: z.string().datetime(),
})

const updateSchema = z
  .object({
    amount: z.number().int().positive().optional(),
    note: z.string().max(255).optional(),
    categoryId: uuidOrNull,
    accountId: uuidOrNull,
    fromAccountId: uuidOrNull,
    toAccountId: uuidOrNull,
    txnDate: z.string().date().optional(),
    updatedAt: z.string().datetime(),
  })
  .refine((patch) => Object.keys(patch).length > 1, { message: 'at least one field besides updatedAt is required' })

const deleteSchema = z.object({ updatedAt: z.string().datetime() })

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
      const result = await repo.upsert(pool, { ...parsed.data, updatedAt: toMysqlDatetime(parsed.data.updatedAt) })
      const status = result.created ? 201 : 200
      res.status(status).json(ok(rowToCamel(result.row), { syncStatus: result.status }))
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
        next(new ApiError('NOT_FOUND', 'transaction not found'))
        return
      }

      const merged = { ...rowToCamel(existing), ...parsed.data }
      const fieldError = validateTransactionFields(merged)
      if (fieldError) {
        next(new ApiError('VALIDATION_ERROR', fieldError))
        return
      }

      const result = await repo.updateGuarded(pool, req.params.id, {
        ...parsed.data,
        updatedAt: toMysqlDatetime(parsed.data.updatedAt),
      })
      res.json(ok(rowToCamel(result.row), { syncStatus: result.status }))
    } catch (err) {
      next(err)
    }
  })

  router.delete('/:id', async (req, res, next) => {
    const parsed = deleteSchema.safeParse(req.body)
    if (!parsed.success) {
      next(new ApiError('VALIDATION_ERROR', parsed.error.issues[0].message))
      return
    }

    try {
      const existing = await repo.findById(pool, req.params.id)
      if (!existing) {
        next(new ApiError('NOT_FOUND', 'transaction not found'))
        return
      }

      const result = await repo.softDeleteGuarded(pool, req.params.id, toMysqlDatetime(parsed.data.updatedAt))
      res.json(ok({}, { syncStatus: result.status }))
    } catch (err) {
      next(err)
    }
  })

  return router
}

module.exports = { createTransactionsRouter }
