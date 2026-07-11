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
