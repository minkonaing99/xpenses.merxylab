'use strict'

const jwt = require('jsonwebtoken')
const { makeAuthMiddleware, COOKIE_NAME } = require('../auth')

const SECRET = 'test-secret'

function mockReqRes(cookies) {
  return { req: { cookies }, res: {}, next: jest.fn() }
}

describe('makeAuthMiddleware', () => {
  it('calls next() with no error for a valid token', () => {
    const token = jwt.sign({ sub: 'owner' }, SECRET, { expiresIn: '1h' })
    const middleware = makeAuthMiddleware(SECRET)
    const { req, res, next } = mockReqRes({ [COOKIE_NAME]: token })

    middleware(req, res, next)

    expect(next).toHaveBeenCalledWith()
  })

  it('calls next(error) with UNAUTHORIZED when the cookie is missing', () => {
    const middleware = makeAuthMiddleware(SECRET)
    const { req, res, next } = mockReqRes({})

    middleware(req, res, next)

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'UNAUTHORIZED' }))
  })

  it('calls next(error) with UNAUTHORIZED for an expired token', () => {
    const token = jwt.sign({ sub: 'owner' }, SECRET, { expiresIn: -1 })
    const middleware = makeAuthMiddleware(SECRET)
    const { req, res, next } = mockReqRes({ [COOKIE_NAME]: token })

    middleware(req, res, next)

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'UNAUTHORIZED' }))
  })

  it('calls next(error) with UNAUTHORIZED for a token signed with the wrong secret', () => {
    const token = jwt.sign({ sub: 'owner' }, 'wrong-secret', { expiresIn: '1h' })
    const middleware = makeAuthMiddleware(SECRET)
    const { req, res, next } = mockReqRes({ [COOKIE_NAME]: token })

    middleware(req, res, next)

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'UNAUTHORIZED' }))
  })

  it('calls next(error) with UNAUTHORIZED for a malformed token', () => {
    const middleware = makeAuthMiddleware(SECRET)
    const { req, res, next } = mockReqRes({ [COOKIE_NAME]: 'not-a-jwt' })

    middleware(req, res, next)

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'UNAUTHORIZED' }))
  })

  describe('bearer API token', () => {
    const API_TOKEN = 'a-long-enough-api-token-value-123'

    function reqWithHeader(authorization) {
      return {
        req: {
          cookies: {},
          method: 'GET',
          baseUrl: '/api/accounts',
          path: '/',
          get: (h) => (h.toLowerCase() === 'authorization' ? authorization : undefined),
        },
        res: {},
        next: jest.fn(),
      }
    }

    it('authenticates a request whose Bearer token matches the configured API token', () => {
      const middleware = makeAuthMiddleware(SECRET, API_TOKEN)
      const { req, res, next } = reqWithHeader(`Bearer ${API_TOKEN}`)

      middleware(req, res, next)

      expect(next).toHaveBeenCalledWith()
    })

    it('rejects a Bearer token that does not match', () => {
      const middleware = makeAuthMiddleware(SECRET, API_TOKEN)
      const { req, res, next } = reqWithHeader('Bearer wrong-token-wrong-token-wrong')

      middleware(req, res, next)

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'UNAUTHORIZED' }))
    })

    it('ignores the Authorization header when no API token is configured', () => {
      const middleware = makeAuthMiddleware(SECRET)
      const { req, res, next } = reqWithHeader(`Bearer ${API_TOKEN}`)

      middleware(req, res, next)

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'UNAUTHORIZED' }))
    })
  })
})


describe('bearer permissions on mounted routes', () => {
  const express = require('express')
  const request = require('supertest')
  const errorHandler = require('../error')
  const apiToken = 'a-long-enough-api-token-value-123'
  const app = express()
  app.use(require('cookie-parser')())
  const middleware = makeAuthMiddleware(SECRET, apiToken)
  const uuid = '20ec5727-0940-4ce6-9e45-feca871b47df'
  for (const mount of ['accounts', 'categories', 'transactions', 'budgets', 'insights', 'plans', 'recurring', 'sync', 'savings-pots']) {
    app.use(`/api/${mount}`, middleware, (req, res) => res.json({ ok: true }))
  }
  app.use(errorHandler)

  it.each([
    ['get', '/api/accounts'], ['get', '/api/categories/'],
    ['get', '/api/transactions?month=2026-10'], ['get', '/api/budgets'],
    ['get', '/api/insights/forecast'], ['get', '/api/insights/anomalies'],
    ['get', '/api/insights/comparisons'], ['get', '/api/plans'],
    ['post', '/api/transactions/bulk'], ['post', '/api/plans/'],
    ['patch', `/api/transactions/${uuid}`], ['delete', `/api/transactions/${uuid}`],
    ['get', '/api/recurring'], ['post', '/api/recurring'],
    ['post', `/api/plans/${uuid}/confirm`], ['delete', `/api/plans/${uuid}`],
  ])('allows %s %s', async (method, path) => {
    await request(app)[method](path).set('Authorization', `Bearer ${apiToken}`).expect(200)
  })

  it.each([
    ['delete', '/api/transactions/id'], ['patch', `/api/plans/${uuid}`],
    ['post', '/api/plans/id/confirm'], ['post', '/api/transactions'],
    ['delete', '/api/transactions/bulk'], ['patch', `/api/recurring/${uuid}`],
    ['delete', `/api/recurring/${uuid}`], ['get', `/api/transactions/${uuid}/x`],
    ['post', '/api/accounts'], ['get', '/api/sync'], ['post', '/api/sync'],
    ['get', '/api/accounts/id/balance-check'], ['get', '/api/savings-pots'],
    ['put', '/api/transactions/bulk'], ['head', '/api/accounts'],
  ])('forbids %s %s even with a valid cookie', async (method, path) => {
    const response = await request(app)[method](path)
      .set('Authorization', `Bearer ${apiToken}`)
      .set('Cookie', `${COOKIE_NAME}=${jwt.sign({ sub: 'owner' }, SECRET)}`)
      .expect(403)
    if (method !== 'head') expect(response.body.error.code).toBe('FORBIDDEN')
  })
})


it('keeps cookie-only browser writes authorized', async () => {
  const middleware = makeAuthMiddleware(SECRET, 'a-long-enough-api-token-value-123')
  const { req, res, next } = mockReqRes({ [COOKIE_NAME]: jwt.sign({ sub: 'owner' }, SECRET) })
  middleware({ ...req, method: 'DELETE', baseUrl: '/api/transactions', path: '/id' }, res, next)
  expect(next).toHaveBeenCalledWith()
})
