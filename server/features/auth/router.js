'use strict'

const express = require('express')
const rateLimit = require('express-rate-limit')
const { z } = require('zod')
const { ok, ApiError } = require('../../lib/apiResponse')
const { makeAuthMiddleware, COOKIE_NAME } = require('../../middleware/auth')
const { verifyPassword, signToken } = require('./service')

const loginSchema = z.object({ password: z.string().min(1) })

const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000 // matches service.js TOKEN_TTL

function cookieOptions(nodeEnv) {
  return {
    httpOnly: true,
    secure: nodeEnv === 'production',
    sameSite: 'lax',
  }
}

function createAuthRouter({ passwordHash, jwtSecret, nodeEnv, rateLimit: rateLimitOverrides }) {
  const router = express.Router()
  const authMiddleware = makeAuthMiddleware(jwtSecret)

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({ ok: false, error: { code: 'RATE_LIMITED', message: 'too many login attempts' } })
    },
    ...rateLimitOverrides,
  })

  router.post('/login', loginLimiter, async (req, res, next) => {
    const parsed = loginSchema.safeParse(req.body)
    if (!parsed.success) {
      next(new ApiError('VALIDATION_ERROR', 'password is required'))
      return
    }

    try {
      const valid = await verifyPassword(parsed.data.password, passwordHash)
      if (!valid) {
        next(new ApiError('UNAUTHORIZED', 'invalid password'))
        return
      }

      const token = signToken(jwtSecret)
      res.cookie(COOKIE_NAME, token, { ...cookieOptions(nodeEnv), maxAge: SESSION_MAX_AGE_MS })
      res.json(ok({}))
    } catch (err) {
      next(err)
    }
  })

  router.post('/logout', authMiddleware, (req, res) => {
    res.clearCookie(COOKIE_NAME, cookieOptions(nodeEnv))
    res.json(ok({}))
  })

  router.get('/me', authMiddleware, (req, res) => {
    res.json(ok({ authenticated: true }))
  })

  return router
}

module.exports = { createAuthRouter }
