import { describe, expect, it } from 'vitest'
import { validateTransactionFields } from './validateTransactionFields'

describe('validateTransactionFields', () => {
  it('requires categoryId and accountId for expense', () => {
    expect(validateTransactionFields({ type: 'expense', categoryId: null, accountId: 'a1' })).toMatch(/categoryId/)
    expect(validateTransactionFields({ type: 'expense', categoryId: 'c1', accountId: null })).toMatch(/accountId/)
    expect(validateTransactionFields({ type: 'expense', categoryId: 'c1', accountId: 'a1' })).toBeNull()
  })

  it('rejects expense with from/to accounts set', () => {
    expect(
      validateTransactionFields({ type: 'expense', categoryId: 'c1', accountId: 'a1', fromAccountId: 'a1' }),
    ).toMatch(/fromAccountId/)
  })

  it('requires accountId for income and rejects categoryId', () => {
    expect(validateTransactionFields({ type: 'income', accountId: null })).toMatch(/accountId/)
    expect(validateTransactionFields({ type: 'income', accountId: 'a1', categoryId: 'c1' })).toMatch(/categoryId/)
    expect(validateTransactionFields({ type: 'income', accountId: 'a1' })).toBeNull()
  })

  it('requires distinct fromAccountId/toAccountId for transfer', () => {
    expect(validateTransactionFields({ type: 'transfer', fromAccountId: null, toAccountId: 'a2' })).toMatch(/fromAccountId/)
    expect(validateTransactionFields({ type: 'transfer', fromAccountId: 'a1', toAccountId: null })).toMatch(/toAccountId/)
    expect(validateTransactionFields({ type: 'transfer', fromAccountId: 'a1', toAccountId: 'a1' })).toMatch(/differ/)
    expect(validateTransactionFields({ type: 'transfer', fromAccountId: 'a1', toAccountId: 'a2' })).toBeNull()
  })

  it('rejects an unknown type', () => {
    expect(validateTransactionFields({ type: 'bogus' })).toMatch(/unknown/)
  })
})
