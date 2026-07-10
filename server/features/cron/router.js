'use strict'

const express = require('express')
const { ok, ApiError } = require('../../lib/apiResponse')
const { safeCompare } = require('../../lib/safeCompare')
const { todayInBangkok } = require('../../cron/dateUtil')
const { runCronOnce } = require('../recurring/runner')

// Plan B: Hostinger external cron hits this instead of relying on
// in-process node-cron staying warm on shared hosting (docs/TECH.md §9).
// Auth is a shared-secret header, not the JWT cookie — an external cron
// job has no browser session.
function createCronRouter(pool, cronSharedSecret) {
  const router = express.Router()

  router.post('/run', async (req, res, next) => {
    const provided = req.get('X-Cron-Secret')
    if (!safeCompare(provided, cronSharedSecret)) {
      next(new ApiError('UNAUTHORIZED', 'invalid cron secret'))
      return
    }

    try {
      const results = await runCronOnce(pool, todayInBangkok())
      res.json(ok({ results }))
    } catch (err) {
      next(err)
    }
  })

  return router
}

module.exports = { createCronRouter }
