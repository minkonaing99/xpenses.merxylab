'use strict'

const jwt = require('jsonwebtoken')
const { ApiError } = require('../lib/apiResponse')
const { safeCompare } = require('../lib/safeCompare')
const { loadEnv } = require('../config/env')

const COOKIE_NAME = 'xpenses_token'

// Pull a Bearer token out of the Authorization header, if present.
function bearerToken(req) {
  const header = typeof req.get === 'function' ? req.get('authorization') : undefined
  if (!header || !header.startsWith('Bearer ')) return null
  return header.slice('Bearer '.length)
}

// Auth accepts either the browser's JWT cookie or, when an API token is
// configured, a matching `Authorization: Bearer <token>` (for the MCP server
// and other programmatic clients). The token is compared in constant time.
function makeAuthMiddleware(jwtSecret, apiToken) {
  return function authMiddleware(req, res, next) {
    if (apiToken) {
      const presented = bearerToken(req)
      if (presented && safeCompare(presented, apiToken)) {
        next()
        return
      }
    }

    const token = req.cookies && req.cookies[COOKIE_NAME]
    if (!token) {
      next(new ApiError('UNAUTHORIZED', 'authentication required'))
      return
    }

    try {
      jwt.verify(token, jwtSecret, { algorithms: ['HS256'] })
      next()
    } catch {
      next(new ApiError('UNAUTHORIZED', 'authentication required'))
    }
  }
}

let authMiddleware

function getAuthMiddleware() {
  if (!authMiddleware) {
    const env = loadEnv()
    authMiddleware = makeAuthMiddleware(env.jwtSecret, env.apiToken)
  }
  return authMiddleware
}

module.exports = { makeAuthMiddleware, getAuthMiddleware, COOKIE_NAME }
