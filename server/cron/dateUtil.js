'use strict'

const FORMATTER = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' })

// Asia/Bangkok is a fixed UTC+7 with no DST — safe to format directly.
function todayInBangkok(now = new Date()) {
  return FORMATTER.format(now)
}

module.exports = { todayInBangkok }
