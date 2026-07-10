'use strict'

const { rowToCamel } = require('../caseMap')

describe('rowToCamel', () => {
  it('converts snake_case DB row keys to camelCase', () => {
    expect(rowToCamel({ starting_balance: 0, sort_order: 1, name: 'Cash' })).toEqual({
      startingBalance: 0,
      sortOrder: 1,
      name: 'Cash',
    })
  })

  it('returns null/undefined as-is', () => {
    expect(rowToCamel(null)).toBeNull()
    expect(rowToCamel(undefined)).toBeUndefined()
  })

  it('leaves already-camelCase or single-word keys unchanged', () => {
    expect(rowToCamel({ id: '1', createdAt: 'x' })).toEqual({ id: '1', createdAt: 'x' })
  })
})
