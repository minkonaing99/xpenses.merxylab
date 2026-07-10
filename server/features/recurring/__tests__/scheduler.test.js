'use strict'

const { addInterval, planDueRuns } = require('../scheduler')

describe('addInterval', () => {
  it('adds days', () => {
    expect(addInterval('2026-07-01', 'day', 1)).toBe('2026-07-02')
  })

  it('adds weeks (7 days per count)', () => {
    expect(addInterval('2026-07-01', 'week', 2)).toBe('2026-07-15')
  })

  it('adds months, preserving day-of-month', () => {
    expect(addInterval('2026-07-15', 'month', 1)).toBe('2026-08-15')
  })

  it('rolls over into the next year', () => {
    expect(addInterval('2026-12-15', 'month', 1)).toBe('2027-01-15')
  })

  it('clamps day-of-month when the target month is shorter (Jan 31 + 1 month)', () => {
    expect(addInterval('2026-01-31', 'month', 1)).toBe('2026-02-28')
  })

  it('handles a leap-year February correctly', () => {
    expect(addInterval('2028-01-31', 'month', 1)).toBe('2028-02-29')
  })

  it('advances by intervalCount months at once', () => {
    expect(addInterval('2026-01-31', 'month', 2)).toBe('2026-03-31')
  })
})

describe('planDueRuns', () => {
  const dailyRule = { intervalUnit: 'day', intervalCount: 1, nextRunDate: '2026-07-10' }

  it('generates one run when the rule is due exactly today', () => {
    const { runDates, nextRunDate } = planDueRuns(dailyRule, '2026-07-10')
    expect(runDates).toEqual(['2026-07-10'])
    expect(nextRunDate).toBe('2026-07-11')
  })

  it('returns no runs when the rule is not yet due', () => {
    const { runDates, nextRunDate } = planDueRuns({ ...dailyRule, nextRunDate: '2026-07-15' }, '2026-07-10')
    expect(runDates).toEqual([])
    expect(nextRunDate).toBe('2026-07-15')
  })

  it('catches up multiple missed daily runs (cron did not run for 3 days)', () => {
    const { runDates, nextRunDate } = planDueRuns({ ...dailyRule, nextRunDate: '2026-07-08' }, '2026-07-10')
    expect(runDates).toEqual(['2026-07-08', '2026-07-09', '2026-07-10'])
    expect(nextRunDate).toBe('2026-07-11')
  })

  it('handles a monthly rule overdue by exactly one cycle', () => {
    const monthlyRule = { intervalUnit: 'month', intervalCount: 1, nextRunDate: '2026-06-01' }
    const { runDates, nextRunDate } = planDueRuns(monthlyRule, '2026-06-15')
    expect(runDates).toEqual(['2026-06-01'])
    expect(nextRunDate).toBe('2026-07-01')
  })

  it('catches up two missed monthly cycles', () => {
    const monthlyRule = { intervalUnit: 'month', intervalCount: 1, nextRunDate: '2026-06-01' }
    const { runDates, nextRunDate } = planDueRuns(monthlyRule, '2026-07-10')
    expect(runDates).toEqual(['2026-06-01', '2026-07-01'])
    expect(nextRunDate).toBe('2026-08-01')
  })

  it('handles intervalCount > 1 (every 2 weeks)', () => {
    const biweekly = { intervalUnit: 'week', intervalCount: 2, nextRunDate: '2026-07-01' }
    const { runDates, nextRunDate } = planDueRuns(biweekly, '2026-07-10')
    expect(runDates).toEqual(['2026-07-01'])
    expect(nextRunDate).toBe('2026-07-15')
  })
})
