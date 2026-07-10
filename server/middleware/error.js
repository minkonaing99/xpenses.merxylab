'use strict'

const { fail, ApiError } = require('../lib/apiResponse')

// Central error -> envelope mapper. Never leak stack traces or raw error
// messages for unexpected errors — only ApiError's declared message is safe
// to send to the client (see docs/TECH.md Security "Error responses").
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    res.status(err.status).json(fail(err.code, err.message))
    return
  }

  console.error('Unhandled error:', err)
  res.status(500).json(fail('SERVER_ERROR', 'Internal server error'))
}

module.exports = errorHandler
