'use strict'

const { computeNet } = require('../service')

describe('computeNet', () => {
  it('subtracts expense from income', () => {
    expect(computeNet(50000, 32000)).toBe(18000)
  })

  it('handles zero income (all expense)', () => {
    expect(computeNet(0, 5000)).toBe(-5000)
  })

  it('handles zero expense (all income)', () => {
    expect(computeNet(5000, 0)).toBe(5000)
  })

  it('handles both zero', () => {
    expect(computeNet(0, 0)).toBe(0)
  })
})
