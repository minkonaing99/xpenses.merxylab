import { describe, expect, it } from 'vitest'
import { formatTHB } from './money'

describe('formatTHB', () => {
  it('formats whole-baht satang with no decimals and thousands separators', () => {
    expect(formatTHB(642000)).toBe('฿6,420')
  })

  it('formats satang with a fractional baht remainder as 2 decimals', () => {
    expect(formatTHB(86050)).toBe('฿860.50')
  })

  it('formats zero as ฿0', () => {
    expect(formatTHB(0)).toBe('฿0')
  })

  it('formats negative satang with a leading minus before the symbol', () => {
    expect(formatTHB(-86000)).toBe('-฿860')
  })
})
