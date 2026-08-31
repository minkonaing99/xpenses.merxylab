'use strict'

const express = require('express')
const { ok } = require('../../lib/apiResponse')
const { rowToCamel } = require('../../lib/caseMap')
const { writeEntity } = require('../entityWrites/writer')
const repo = require('./repo')

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
    try {
      const result = await writeEntity(pool, {
        entity: 'categories',
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
        entity: 'categories',
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
        entity: 'categories',
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

module.exports = { createCategoriesRouter }
