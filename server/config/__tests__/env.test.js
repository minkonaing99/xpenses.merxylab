'use strict'

const { loadEnv, REQUIRED_KEYS } = require('../env')

const VALID_ENV = {
  NODE_ENV: 'development',
  DB_HOST: 'localhost',
  DB_PORT: '3306',
  DB_USER: 'root',
  DB_PASSWORD: 'secret',
  DB_NAME: 'xpense',
  PASSWORD_HASH: '$2b$10$abcdefghijklmnopqrstuv',
  JWT_SECRET: 'a'.repeat(32),
  CRON_SHARED_SECRET: 'b'.repeat(32),
}

describe('loadEnv', () => {
  it('returns a config object with DB_PORT coerced to a number', () => {
    const config = loadEnv(VALID_ENV)
    expect(config.dbPort).toBe(3306)
    expect(config.dbHost).toBe('localhost')
    expect(config.nodeEnv).toBe('development')
  })

  it.each(REQUIRED_KEYS)('throws when %s is missing', (key) => {
    const incomplete = { ...VALID_ENV }
    delete incomplete[key]
    expect(() => loadEnv(incomplete)).toThrow(key)
  })

  it('throws when DB_PORT is not a valid number', () => {
    expect(() => loadEnv({ ...VALID_ENV, DB_PORT: 'not-a-number' })).toThrow('DB_PORT')
  })
})
