'use strict'

const express = require('express')
const { z } = require('zod')
const { ok, ApiError } = require('../../lib/apiResponse')
const repo = require('./repo')
const { mapAccountRow } = require('./service')

const ACCOUNT_TYPES = ['cash', 'bank', 'other']

const createSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(80),
  type: z.enum(ACCOUNT_TYPES).optional(),
  startingBalance: z.number().int().optional(),
  sortOrder: z.number().int().optional(),
})

const updateSchema = z
  .object({
    name: z.string().min(1).max(80).optional(),
    type: z.enum(ACCOUNT_TYPES).optional(),
    startingBalance: z.number().int().optional(),
    sortOrder: z.number().int().optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0, { message: 'at least one field is required' })

function createAccountsRouter(pool) {
  const router = express.Router()

  router.get('/', async (req, res, next) => {
    try {
      const rows = await repo.findAllWithSums(pool)
      res.json(ok(rows.map(mapAccountRow)))
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
      await repo.create(pool, parsed.data)
      const created = await repo.findByIdWithSums(pool, parsed.data.id)
      res.status(201).json(ok(mapAccountRow(created)))
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        next(new ApiError('CONFLICT', 'account already exists'))
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
        next(new ApiError('NOT_FOUND', 'account not found'))
        return
      }

      await repo.update(pool, req.params.id, parsed.data)
      const updated = await repo.findByIdWithSums(pool, req.params.id)
      res.json(ok(mapAccountRow(updated)))
    } catch (err) {
      next(err)
    }
  })

  router.delete('/:id', async (req, res, next) => {
    try {
      const existing = await repo.findById(pool, req.params.id)
      if (!existing) {
        next(new ApiError('NOT_FOUND', 'account not found'))
        return
      }

      const referenceCount = await repo.countReferences(pool, req.params.id)
      if (referenceCount > 0) {
        next(new ApiError('CONFLICT', 'account is referenced by existing transactions'))
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

module.exports = { createAccountsRouter }
