'use strict'

const jwt = require('jsonwebtoken')
const { ApiError } = require('../lib/apiResponse')
const { safeCompare } = require('../lib/safeCompare')
const { loadEnv } = require('../config/env')

const COOKIE_NAME = 'xpenses_token'

const MCP_READ_PATHS = [
  '/api/accounts', '/api/categories', '/api/transactions', '/api/budgets',
  '/api/plans', '/api/recurring', '/api/insights/forecast', '/api/insights/anomalies', '/api/insights/comparisons',
]
const MCP_CREATE_PATHS = ['/api/transactions/bulk', '/api/plans', '/api/recurring']
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const MCP_ID_ROUTES = [
  ['PATCH', new RegExp(`^/api/transactions/${UUID}$`, 'i')],
  ['DELETE', new RegExp(`^/api/transactions/${UUID}$`, 'i')],
  ['POST', new RegExp(`^/api/plans/${UUID}/confirm$`, 'i')],
  ['DELETE', new RegExp(`^/api/plans/${UUID}$`, 'i')],
]

function allowsApiToken(req) {
  const path = `${req.baseUrl || ''}${req.path || ''}`.replace(/\/$/, '')
  return (req.method === 'GET' && MCP_READ_PATHS.includes(path))
    || (req.method === 'POST' && MCP_CREATE_PATHS.includes(path))
    || MCP_ID_ROUTES.some(([method, pattern]) => req.method === method && pattern.test(path))
}

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
        if (!allowsApiToken(req)) {
          next(new ApiError('FORBIDDEN', 'API token does not permit this operation'))
          return
        }
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
