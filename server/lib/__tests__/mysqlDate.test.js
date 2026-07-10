'use strict'

const { toMysqlDatetime } = require('../mysqlDate')

describe('toMysqlDatetime', () => {
  it('converts an ISO 8601 datetime to MySQL DATETIME format (UTC)', () => {
    expect(toMysqlDatetime('2026-07-10T09:00:00.000Z')).toBe('2026-07-10 09:00:00')
  })

  it('normalizes a non-UTC offset to UTC', () => {
    expect(toMysqlDatetime('2026-07-10T16:00:00.000+07:00')).toBe('2026-07-10 09:00:00')
  })
})
