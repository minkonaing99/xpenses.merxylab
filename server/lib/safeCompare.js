'use strict'

const crypto = require('crypto')

// Constant-time comparison for secrets (cron shared-secret header, etc.) —
// plain === leaks timing info proportional to the matching prefix length.
function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

module.exports = { safeCompare }
