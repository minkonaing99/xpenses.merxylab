'use strict'

const express = require('express')
const { ok } = require('../../lib/apiResponse')
const { writeEntity } = require('../entityWrites/writer')
const repo = require('./repo')
const { mapAccountRow } = require('./service')

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
    try {
      const result = await writeEntity(pool, {
        entity: 'accounts',
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
        entity: 'accounts',
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
        entity: 'accounts',
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

module.exports = { createAccountsRouter }
