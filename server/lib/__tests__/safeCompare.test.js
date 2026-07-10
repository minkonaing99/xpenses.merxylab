'use strict'

const { safeCompare } = require('../safeCompare')

describe('safeCompare', () => {
  it('returns true for identical strings', () => {
    expect(safeCompare('secret123', 'secret123')).toBe(true)
  })

  it('returns false for different strings of the same length', () => {
    expect(safeCompare('secret123', 'secret456')).toBe(false)
  })

  it('returns false for different-length strings (no length-leak crash)', () => {
    expect(safeCompare('short', 'a-much-longer-secret')).toBe(false)
  })

  it('returns false when either value is missing', () => {
    expect(safeCompare(undefined, 'secret')).toBe(false)
    expect(safeCompare('secret', undefined)).toBe(false)
    expect(safeCompare(undefined, undefined)).toBe(false)
  })
})
