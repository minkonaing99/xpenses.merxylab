'use strict'

const express = require('express')
const { z } = require('zod')
const { ok, ApiError } = require('../../lib/apiResponse')
const { rowToCamel } = require('../../lib/caseMap')
const repo = require('./repo')

const createSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(80),
  icon: z.string().max(40).optional(),
  sortOrder: z.number().int().optional(),
})

const updateSchema = z
  .object({
    name: z.string().min(1).max(80).optional(),
    icon: z.string().max(40).optional(),
    sortOrder: z.number().int().optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0, { message: 'at least one field is required' })

function createCategoriesRouter(pool) {
  const router = express.Router()

  router.get('/', async (req, res, next) => {
    try {
      const rows = await repo.findAll(pool)
      res.json(ok(rows.map(rowToCamel)))
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
      const nameTaken = await repo.findActiveByName(pool, parsed.data.name)
      if (nameTaken) {
        next(new ApiError('CONFLICT', 'category name already in use'))
        return
      }

      await repo.create(pool, parsed.data)
      const created = await repo.findById(pool, parsed.data.id)
      res.status(201).json(ok(rowToCamel(created)))
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        next(new ApiError('CONFLICT', 'category already exists'))
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
        next(new ApiError('NOT_FOUND', 'category not found'))
        return
      }

      if (parsed.data.name) {
        const nameTaken = await repo.findActiveByName(pool, parsed.data.name, req.params.id)
        if (nameTaken) {
          next(new ApiError('CONFLICT', 'category name already in use'))
          return
        }
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
        next(new ApiError('NOT_FOUND', 'category not found'))
        return
      }

      const referenceCount = await repo.countReferences(pool, req.params.id)
      if (referenceCount > 0) {
        next(new ApiError('CONFLICT', 'category is referenced by existing transactions or budgets'))
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

module.exports = { createCategoriesRouter, createSchema, updateSchema }
