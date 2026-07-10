'use strict'

const jwt = require('jsonwebtoken')
const { ApiError } = require('../lib/apiResponse')
const { loadEnv } = require('../config/env')

const COOKIE_NAME = 'xpenses_token'

function makeAuthMiddleware(jwtSecret) {
  return function authMiddleware(req, res, next) {
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
    authMiddleware = makeAuthMiddleware(loadEnv().jwtSecret)
  }
  return authMiddleware
}

module.exports = { makeAuthMiddleware, getAuthMiddleware, COOKIE_NAME }
