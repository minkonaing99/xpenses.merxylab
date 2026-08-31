'use strict'

const { toMysqlDatetime } = require('../../lib/mysqlDate')
const { rowToCamel } = require('../../lib/caseMap')
const { validateTransactionFields } = require('../transactions/service')
const txnRepo = require('../transactions/repo')
const accountsRepo = require('../accounts/repo')
const categoriesRepo = require('../categories/repo')
const budgetsRepo = require('../budgets/repo')
const recurringRepo = require('../recurring/repo')
const accountsRouter = require('../accounts/router')
const categoriesRouter = require('../categories/router')
const budgetsRouter = require('../budgets/router')
const recurringRouter = require('../recurring/router')
const { todayInBangkok } = require('../../cron/dateUtil')
const { normalizeResumePatch } = require('../recurring/scheduler')

// Reuse the exact create/update zod schemas the direct REST routes enforce, so
// a write replayed through /api/sync/push can't bypass the same field/type/
// bound validation. `fieldCheck` mirrors the recurring router's extra per-type
// field-matrix check (validateTransactionFields).
const SIMPLE_ENTITIES = {
  accounts: { repo: accountsRepo, schemas: accountsRouter },
  categories: { repo: categoriesRepo, schemas: categoriesRouter },
  budgets: { repo: budgetsRepo, schemas: budgetsRouter },
  recurring: {
    repo: recurringRepo,
    schemas: recurringRouter,
    fieldCheck: true,
    normalizePatch: (rule, patch) =>
      normalizeResumePatch({ ...rule, active: Boolean(rule.active) }, patch, todayInBangkok()),
  },
}

async function applyTransactionOp(pool, action, payload) {
  const id = payload.id

  if (action === 'delete') {
    const result = await txnRepo.softDeleteGuarded(pool, id, toMysqlDatetime(payload.updatedAt))
    if (result.status === 'not_found') return { id, status: 'error', code: 'NOT_FOUND' }
    return { id, status: result.status }
  }

  const fieldError = validateTransactionFields(payload)
  if (fieldError) return { id, status: 'error', code: 'VALIDATION_ERROR' }

  const result = await txnRepo.upsert(pool, { ...payload, updatedAt: toMysqlDatetime(payload.updatedAt) })
  return { id, status: result.status }
}

// Accounts/categories/budgets/recurring have server-managed updated_at (no
// client clock to compare) — there's no LWW skip concept for them, only
// found/not-found. Retrying an already-applied op is treated as a success
// (idempotent), not an error, so a client outbox can safely replay.
async function applySimpleOp(pool, config, action, payload) {
  const { repo, schemas, fieldCheck, normalizePatch } = config
  const id = payload.id
  try {
    if (action === 'create') {
      const parsed = schemas.createSchema.safeParse(payload)
      if (!parsed.success) return { id, status: 'error', code: 'VALIDATION_ERROR' }
      if (fieldCheck && validateTransactionFields(parsed.data)) {
        return { id, status: 'error', code: 'VALIDATION_ERROR' }
      }
      await repo.create(pool, parsed.data)
      return { id, status: 'applied' }
    }
    if (action === 'update') {
      const existing = await repo.findById(pool, id)
      if (!existing) return { id, status: 'error', code: 'NOT_FOUND' }
      const parsed = schemas.updateSchema.safeParse(payload)
      if (!parsed.success) return { id, status: 'error', code: 'VALIDATION_ERROR' }
      const existingEntity = rowToCamel(existing)
      const patch = normalizePatch ? normalizePatch(existingEntity, parsed.data) : parsed.data
      if (fieldCheck && validateTransactionFields({ ...existingEntity, ...patch })) {
        return { id, status: 'error', code: 'VALIDATION_ERROR' }
      }
      await repo.update(pool, id, patch)
      return { id, status: 'applied' }
    }
    if (action === 'delete') {
      const existing = await repo.findById(pool, id)
      if (!existing) return { id, status: 'applied' }
      await repo.softDelete(pool, id)
      return { id, status: 'applied' }
    }
    return { id, status: 'error', code: 'VALIDATION_ERROR' }
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return { id, status: 'applied' }
    return { id, status: 'error', code: 'SERVER_ERROR' }
  }
}

// One op's exception (e.g. a malformed updatedAt that fails Date parsing)
// must not crash the whole batch — every op resolves to a result, never throws.
async function applyOp(pool, op) {
  const { entity, action, payload } = op
  if (!payload || !payload.id) {
    return { id: payload?.id ?? null, status: 'error', code: 'VALIDATION_ERROR' }
  }

  try {
    if (entity === 'transactions') {
      return await applyTransactionOp(pool, action, payload)
    }
    if (SIMPLE_ENTITIES[entity]) {
      return await applySimpleOp(pool, SIMPLE_ENTITIES[entity], action, payload)
    }
    return { id: payload.id, status: 'error', code: 'VALIDATION_ERROR' }
  } catch {
    return { id: payload.id, status: 'error', code: 'VALIDATION_ERROR' }
  }
}

module.exports = { applyOp }
