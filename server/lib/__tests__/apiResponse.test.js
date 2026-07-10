'use strict'

const { ok, fail, ERROR_CODES, ApiError } = require('../apiResponse')

describe('ok', () => {
  it('wraps data in the success envelope', () => {
    expect(ok({ id: 1 })).toEqual({ ok: true, data: { id: 1 }, meta: {} })
  })

  it('accepts an optional meta object', () => {
    expect(ok([1, 2], { total: 2 })).toEqual({ ok: true, data: [1, 2], meta: { total: 2 } })
  })
})

describe('fail', () => {
  it('wraps a code + message in the error envelope', () => {
    expect(fail('VALIDATION_ERROR', 'amount must be > 0')).toEqual({
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: 'amount must be > 0' },
    })
  })

  it('rejects a code outside the documented set', () => {
    expect(() => fail('NOT_A_REAL_CODE', 'x')).toThrow('NOT_A_REAL_CODE')
  })
})

describe('ApiError', () => {
  it('carries a code, message, and matching HTTP status', () => {
    const err = new ApiError('UNAUTHORIZED', 'invalid credentials')
    expect(err).toBeInstanceOf(Error)
    expect(err.code).toBe('UNAUTHORIZED')
    expect(err.message).toBe('invalid credentials')
    expect(err.status).toBe(401)
  })

  it('rejects a code outside the documented set', () => {
    expect(() => new ApiError('NOT_A_REAL_CODE', 'x')).toThrow('NOT_A_REAL_CODE')
  })
})

describe('ERROR_CODES', () => {
  it('matches the codes documented in docs/SCHEMA.md', () => {
    expect(ERROR_CODES).toEqual([
      'VALIDATION_ERROR',
      'UNAUTHORIZED',
      'NOT_FOUND',
      'CONFLICT',
      'RATE_LIMITED',
      'SERVER_ERROR',
    ])
  })
})
