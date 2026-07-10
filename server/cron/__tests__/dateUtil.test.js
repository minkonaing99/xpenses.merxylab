'use strict'

const { todayInBangkok } = require('../dateUtil')

describe('todayInBangkok', () => {
  it('returns a YYYY-MM-DD formatted date string', () => {
    expect(todayInBangkok()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('matches a fixed instant converted to Asia/Bangkok (UTC+7, no DST)', () => {
    // 2026-07-10T20:30:00Z -> 2026-07-11 03:30 in Bangkok (UTC+7)
    const fixed = new Date('2026-07-10T20:30:00.000Z')
    expect(todayInBangkok(fixed)).toBe('2026-07-11')
  })

  it('stays on the same day for a morning UTC instant', () => {
    // 2026-07-10T01:00:00Z -> 2026-07-10 08:00 in Bangkok
    const fixed = new Date('2026-07-10T01:00:00.000Z')
    expect(todayInBangkok(fixed)).toBe('2026-07-10')
  })
})
