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
})
