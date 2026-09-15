'use strict'

const express = require('express')
const { z } = require('zod')
const { ok } = require('../../lib/apiResponse')
const { ApiError } = require('../../lib/apiResponse')
const { rowToCamel } = require('../../lib/caseMap')
const { writeEntity } = require('../entityWrites/writer')
const repo = require('./repo')
const { mapAccountRow } = require('./service')

function createAccountsRouter(pool) {
  const router = express.Router()
  const checkSchema = z.object({
    id: z.string().uuid(),
    actualBalance: z.number().int().safe(),
    expectedRevision: z.number().int().safe().nonnegative(),
  }).strict()

  const mapCheck = (row, revision) => row ? {
    ...rowToCamel(row),
    actualBalance: Number(row.actual_balance),
    trackedBalance: Number(row.tracked_balance),
    accountRevision: Number(row.account_revision),
    needsReview: Number(row.account_revision) !== Number(revision),
  } : null

  router.get('/', async (req, res, next) => {
    try {
      const rows = await repo.findAllWithSums(pool)
      res.json(ok(rows.map(mapAccountRow)))
    } catch (err) {
      next(err)
    }
  })

  router.get('/:id/balance-check', async (req, res, next) => {
    if (!z.string().uuid().safeParse(req.params.id).success) return next(new ApiError('VALIDATION_ERROR', 'invalid account id'))
    try {
      const accountRow = await repo.findByIdWithSums(pool, req.params.id)
      if (!accountRow) return next(new ApiError('NOT_FOUND', 'account not found'))
      const account = mapAccountRow(accountRow)
      const latest = await repo.findLatestCheck(pool, req.params.id)
      const recent = await repo.findRecentTransactions(pool, req.params.id)
      res.json(ok({
        account,
        latestCheck: mapCheck(latest, account.balanceRevision),
        recentTransactions: recent.map(rowToCamel),
      }))
    } catch (err) {
      next(err)
    }
  })

  router.post('/:id/balance-check', async (req, res, next) => {
    const parsed = checkSchema.safeParse(req.body)
    if (!parsed.success || !z.string().uuid().safeParse(req.params.id).success) {
      return next(new ApiError('VALIDATION_ERROR', parsed.error?.issues[0].message || 'invalid account id'))
    }
    const connection = await pool.getConnection()
    try {
      await connection.beginTransaction()
      const locked = await repo.findByIdForUpdate(connection, req.params.id)
      if (!locked) throw new ApiError('NOT_FOUND', 'account not found')
      const existing = await repo.findCheckById(connection, parsed.data.id)
      if (existing) {
        const same = existing.account_id === req.params.id
          && Number(existing.actual_balance) === parsed.data.actualBalance
          && Number(existing.account_revision) === parsed.data.expectedRevision
        if (!same) throw new ApiError('CONFLICT', 'balance check id already used')
        await connection.commit()
        return res.json(ok(mapCheck(existing, locked.balance_revision)))
      }
      const account = mapAccountRow(await repo.findByIdWithSums(connection, req.params.id))
      if (Number(account.balanceRevision) !== parsed.data.expectedRevision) {
        throw new ApiError('CONFLICT', 'account balance changed; review again')
      }
      if (account.balance !== parsed.data.actualBalance) {
        throw new ApiError('CONFLICT', 'actual and tracked balances must match')
      }
      const row = await repo.createCheck(connection, {
        id: parsed.data.id,
        accountId: req.params.id,
        actualBalance: parsed.data.actualBalance,
        trackedBalance: account.balance,
        accountRevision: account.balanceRevision,
      })
      await connection.commit()
      res.status(201).json(ok(mapCheck(row, account.balanceRevision)))
    } catch (err) {
      await connection.rollback()
      next(err)
    } finally {
      connection.release()
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
