'use strict'

// Response envelope shape — see docs/SCHEMA.md "Response Envelope".
const ERROR_CODES = ['VALIDATION_ERROR', 'UNAUTHORIZED', 'NOT_FOUND', 'CONFLICT', 'RATE_LIMITED', 'SERVER_ERROR']

const STATUS_BY_CODE = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  SERVER_ERROR: 500,
}

function ok(data, meta = {}) {
  return { ok: true, data, meta }
}

function fail(code, message) {
  if (!ERROR_CODES.includes(code)) {
    throw new Error(`Unknown error code: ${code}`)
  }
  return { ok: false, error: { code, message } }
}

class ApiError extends Error {
  constructor(code, message) {
    if (!ERROR_CODES.includes(code)) {
      throw new Error(`Unknown error code: ${code}`)
    }
    super(message)
    this.code = code
    this.status = STATUS_BY_CODE[code]
  }
}

module.exports = { ok, fail, ERROR_CODES, STATUS_BY_CODE, ApiError }
