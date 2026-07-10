'use strict'

const { validateTransactionFields, encodeCursor, decodeCursor, shouldApply } = require('../service')

const CAT = 'cat-1'
const ACCT = 'acct-1'
const ACCT_2 = 'acct-2'

describe('validateTransactionFields — expense', () => {
  it('accepts categoryId + accountId, no from/to', () => {
    expect(
      validateTransactionFields({ type: 'expense', categoryId: CAT, accountId: ACCT, fromAccountId: null, toAccountId: null }),
    ).toBeNull()
  })

  it('rejects a missing categoryId', () => {
    expect(
      validateTransactionFields({ type: 'expense', categoryId: null, accountId: ACCT, fromAccountId: null, toAccountId: null }),
    ).toMatch(/categoryId/)
  })

  it('rejects a missing accountId', () => {
    expect(
      validateTransactionFields({ type: 'expense', categoryId: CAT, accountId: null, fromAccountId: null, toAccountId: null }),
    ).toMatch(/accountId/)
  })

  it('rejects a set fromAccountId', () => {
    expect(
      validateTransactionFields({ type: 'expense', categoryId: CAT, accountId: ACCT, fromAccountId: ACCT_2, toAccountId: null }),
    ).toMatch(/fromAccountId/)
  })

  it('rejects a set toAccountId', () => {
    expect(
      validateTransactionFields({ type: 'expense', categoryId: CAT, accountId: ACCT, fromAccountId: null, toAccountId: ACCT_2 }),
    ).toMatch(/toAccountId/)
  })
})

describe('validateTransactionFields — income', () => {
  it('accepts accountId only, no category/from/to', () => {
    expect(
      validateTransactionFields({ type: 'income', categoryId: null, accountId: ACCT, fromAccountId: null, toAccountId: null }),
    ).toBeNull()
  })

  it('rejects a missing accountId', () => {
    expect(
      validateTransactionFields({ type: 'income', categoryId: null, accountId: null, fromAccountId: null, toAccountId: null }),
    ).toMatch(/accountId/)
  })

  it('rejects a set categoryId', () => {
    expect(
      validateTransactionFields({ type: 'income', categoryId: CAT, accountId: ACCT, fromAccountId: null, toAccountId: null }),
    ).toMatch(/categoryId/)
  })
})

describe('validateTransactionFields — transfer', () => {
  it('accepts fromAccountId + toAccountId (different), no account/category', () => {
    expect(
      validateTransactionFields({ type: 'transfer', categoryId: null, accountId: null, fromAccountId: ACCT, toAccountId: ACCT_2 }),
    ).toBeNull()
  })

  it('rejects fromAccountId === toAccountId', () => {
    expect(
      validateTransactionFields({ type: 'transfer', categoryId: null, accountId: null, fromAccountId: ACCT, toAccountId: ACCT }),
    ).toMatch(/from.*to/i)
  })

  it('rejects a missing toAccountId', () => {
    expect(
      validateTransactionFields({ type: 'transfer', categoryId: null, accountId: null, fromAccountId: ACCT, toAccountId: null }),
    ).toMatch(/toAccountId/)
  })

  it('rejects a set accountId', () => {
    expect(
      validateTransactionFields({ type: 'transfer', categoryId: null, accountId: ACCT, fromAccountId: ACCT, toAccountId: ACCT_2 }),
    ).toMatch(/accountId/)
  })

  it('rejects a set categoryId', () => {
    expect(
      validateTransactionFields({ type: 'transfer', categoryId: CAT, accountId: null, fromAccountId: ACCT, toAccountId: ACCT_2 }),
    ).toMatch(/categoryId/)
  })
})

describe('cursor encode/decode', () => {
  it('round-trips a cursor', () => {
    const cursor = { txnDate: '2026-07-10', createdAt: '2026-07-10 09:00:00', id: 'abc-123' }
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor)
  })

  it('returns null for an invalid/malformed cursor', () => {
    expect(decodeCursor('not-valid-base64-json')).toBeNull()
  })

  it('returns null for undefined/empty input', () => {
    expect(decodeCursor(undefined)).toBeNull()
    expect(decodeCursor('')).toBeNull()
  })

  it('returns null when a field is present but not a string', () => {
    const badCursor = Buffer.from(JSON.stringify({ txnDate: 123, createdAt: '2026-07-10 09:00:00', id: 'x' })).toString(
      'base64',
    )
    expect(decodeCursor(badCursor)).toBeNull()
  })
})

describe('shouldApply — last-write-wins guard', () => {
  it('applies when there is no existing row (create)', () => {
    expect(shouldApply('2026-07-10 09:00:00', null)).toBe(true)
  })

  it('applies when the incoming write is newer than the stored row', () => {
    expect(shouldApply('2026-07-10 10:00:00', '2026-07-10 09:00:00')).toBe(true)
  })

  it('applies when the incoming write has the exact same timestamp (idempotent replay)', () => {
    expect(shouldApply('2026-07-10 09:00:00', '2026-07-10 09:00:00')).toBe(true)
  })

  it('skips when the incoming write is older than the stored row', () => {
    expect(shouldApply('2026-07-10 08:00:00', '2026-07-10 09:00:00')).toBe(false)
  })
})
