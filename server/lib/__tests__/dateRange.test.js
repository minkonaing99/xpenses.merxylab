'use strict'

const { monthRange } = require('../dateRange')

describe('monthRange', () => {
  it('returns [first day of month, first day of next month) for a mid-year month', () => {
    expect(monthRange('2026-07')).toEqual({ start: '2026-07-01', end: '2026-08-01' })
  })

  it('rolls over into January of the next year for December', () => {
    expect(monthRange('2026-12')).toEqual({ start: '2026-12-01', end: '2027-01-01' })
  })

  it('zero-pads single-digit months', () => {
    expect(monthRange('2026-01')).toEqual({ start: '2026-01-01', end: '2026-02-01' })
  })
})
