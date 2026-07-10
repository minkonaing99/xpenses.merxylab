'use strict'

// Per-type field invariants — see docs/SCHEMA.md "Application-level invariants".
// Returns an error message string, or null if valid.
function validateTransactionFields({ type, categoryId, accountId, fromAccountId, toAccountId }) {
  if (type === 'expense') {
    if (!categoryId) return 'expense requires categoryId'
    if (!accountId) return 'expense requires accountId'
    if (fromAccountId) return 'expense must not set fromAccountId'
    if (toAccountId) return 'expense must not set toAccountId'
    return null
  }

  if (type === 'income') {
    if (!accountId) return 'income requires accountId'
    if (categoryId) return 'income must not set categoryId'
    if (fromAccountId) return 'income must not set fromAccountId'
    if (toAccountId) return 'income must not set toAccountId'
    return null
  }

  if (type === 'transfer') {
    if (!fromAccountId) return 'transfer requires fromAccountId'
    if (!toAccountId) return 'transfer requires toAccountId'
    if (fromAccountId === toAccountId) return 'transfer fromAccountId and toAccountId must differ'
    if (accountId) return 'transfer must not set accountId'
    if (categoryId) return 'transfer must not set categoryId'
    return null
  }

  return `unknown transaction type: ${type}`
}

// Opaque keyset-pagination cursor — encodes the sort key of the last row
// returned so the next page can resume with a WHERE (...) < (...) tuple compare.
function encodeCursor(cursor) {
  return Buffer.from(JSON.stringify(cursor)).toString('base64')
}

function decodeCursor(encoded) {
  if (!encoded) return null
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'))
    if (!parsed || typeof parsed !== 'object') return null
    if (typeof parsed.txnDate !== 'string' || typeof parsed.createdAt !== 'string' || typeof parsed.id !== 'string') {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

// Last-write-wins guard — see docs/TECH.md §7 "Sync Reconciliation Rules".
// Both timestamps must already be MySQL DATETIME strings ('YYYY-MM-DD
// HH:MM:SS', UTC) — that fixed-width zero-padded format sorts correctly
// with plain string comparison, so no Date parsing (and its timezone
// pitfalls) is needed here.
function shouldApply(incomingUpdatedAt, existingUpdatedAt) {
  if (existingUpdatedAt == null) return true
  return incomingUpdatedAt >= existingUpdatedAt
}

module.exports = { validateTransactionFields, encodeCursor, decodeCursor, shouldApply }
