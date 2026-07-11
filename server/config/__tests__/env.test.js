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

  it('throws when neither PASSWORD_HASH nor PASSWORD_HASH_B64 is set', () => {
    const env = { ...VALID_ENV }
    delete env.PASSWORD_HASH
    expect(() => loadEnv(env)).toThrow('PASSWORD_HASH')
  })

  it('decodes PASSWORD_HASH_B64 when PASSWORD_HASH is absent', () => {
    const env = { ...VALID_ENV }
    delete env.PASSWORD_HASH
    env.PASSWORD_HASH_B64 = Buffer.from(VALID_ENV.PASSWORD_HASH).toString('base64')
    expect(loadEnv(env).passwordHash).toBe(VALID_ENV.PASSWORD_HASH)
  })

  it('leaves apiToken undefined when API_TOKEN is not set', () => {
    expect(loadEnv(VALID_ENV).apiToken).toBeUndefined()
  })

  it('returns API_TOKEN as apiToken when set', () => {
    const token = 'x'.repeat(24)
    expect(loadEnv({ ...VALID_ENV, API_TOKEN: token }).apiToken).toBe(token)
  })

  it('throws when API_TOKEN is set but too short', () => {
    expect(() => loadEnv({ ...VALID_ENV, API_TOKEN: 'short' })).toThrow('API_TOKEN')
  })
})
