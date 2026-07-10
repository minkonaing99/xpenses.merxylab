'use strict'

const { computeOver, mapBudgetRow } = require('../service')

describe('computeOver', () => {
  it('is false when spent is under the limit', () => {
    expect(computeOver(3000, 5000)).toBe(false)
  })

  it('is false when spent exactly equals the limit', () => {
    expect(computeOver(5000, 5000)).toBe(false)
  })

  it('is true when spent exceeds the limit', () => {
    expect(computeOver(5001, 5000)).toBe(true)
  })
})

describe('mapBudgetRow', () => {
  it('maps a raw DB row (with spent column) to the API shape', () => {
    const row = {
      id: 'b1',
      category_id: 'c1',
      limit_amount: 6000,
      spent: 6420,
      created_at: '2026-07-01 00:00:00',
      updated_at: '2026-07-01 00:00:00',
    }
    expect(mapBudgetRow(row)).toEqual({
      id: 'b1',
      categoryId: 'c1',
      limitAmount: 6000,
      spent: 6420,
      over: true,
      createdAt: '2026-07-01 00:00:00',
      updatedAt: '2026-07-01 00:00:00',
    })
  })

  it('coerces a DECIMAL-string spent (as returned by mysql2 for SUM()) to a number', () => {
    const row = {
      id: 'b1',
      category_id: 'c1',
      limit_amount: 6000,
      spent: '3650',
      created_at: '2026-07-01 00:00:00',
      updated_at: '2026-07-01 00:00:00',
    }
    expect(mapBudgetRow(row)).toEqual(
      expect.objectContaining({ spent: 3650, over: false }),
    )
  })
})
