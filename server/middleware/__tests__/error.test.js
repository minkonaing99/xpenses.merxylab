'use strict'

const { ApiError } = require('../../lib/apiResponse')
const errorHandler = require('../error')

function mockRes() {
  const res = {}
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  return res
}

describe('errorHandler', () => {
  let consoleErrorSpy

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  it('maps an ApiError to its declared status and envelope', () => {
    const res = mockRes()
    errorHandler(new ApiError('UNAUTHORIZED', 'invalid credentials'), {}, res, jest.fn())

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      error: { code: 'UNAUTHORIZED', message: 'invalid credentials' },
    })
  })

  it('maps an unknown error to 500 SERVER_ERROR without leaking the original message', () => {
    const res = mockRes()
    errorHandler(new Error('secret internal detail: SELECT * FROM users'), {}, res, jest.fn())

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      error: { code: 'SERVER_ERROR', message: 'Internal server error' },
    })
  })

  it('logs the original error server-side for unknown errors', () => {
    const res = mockRes()
    const original = new Error('boom')
    errorHandler(original, {}, res, jest.fn())

    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.anything(), original)
  })
})
