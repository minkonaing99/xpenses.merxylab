'use strict'

const cron = require('node-cron')
const { todayInBangkok } = require('./dateUtil')
const { runCronOnce } = require('../features/recurring/runner')

// Daily at 01:00 Asia/Bangkok — a quiet hour, matches docs/TECH.md §9.
// Plan B (`POST /api/cron/run`, features/cron/router.js) covers the case
// where Passenger doesn't keep this process warm on Hostinger shared hosting.
function scheduleRecurringCron(pool) {
  return cron.schedule(
    '0 1 * * *',
    async () => {
      const today = todayInBangkok()
      try {
        const results = await runCronOnce(pool, today)
        console.log(`Recurring cron (${today}):`, results)
      } catch (err) {
        console.error(`Recurring cron (${today}) failed:`, err)
      }
    },
    { timezone: 'Asia/Bangkok' },
  )
}

module.exports = { scheduleRecurringCron }
