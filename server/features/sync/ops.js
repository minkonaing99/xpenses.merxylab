'use strict'

const { ApiError } = require('../../lib/apiResponse')
const { writeEntity } = require('../entityWrites/writer')

async function applyEntityWrite(pool, entity, action, payload) {
  const id = payload.id
  try {
    const result = await writeEntity(pool, { entity, action, id, payload, replay: true })
    return { id, status: result.status }
  } catch (err) {
    if (err instanceof ApiError) return { id, status: 'error', code: err.code }
    return { id, status: 'error', code: 'SERVER_ERROR' }
  }
}

// One invalid op must not crash the whole batch. Every op resolves to a
// per-operation result; write rules stay behind the entity-write seam.
async function applyOp(pool, op) {
  const { entity, action, payload } = op
  if (!payload || !payload.id) {
    return { id: payload?.id ?? null, status: 'error', code: 'VALIDATION_ERROR' }
  }

  try {
    return await applyEntityWrite(pool, entity, action, payload)
  } catch {
    return { id: payload.id, status: 'error', code: 'VALIDATION_ERROR' }
  }
}

module.exports = { applyOp }
