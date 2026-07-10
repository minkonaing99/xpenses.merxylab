'use strict'

const REQUIRED_KEYS = [
  'NODE_ENV',
  'DB_HOST',
  'DB_PORT',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME',
  'PASSWORD_HASH',
  'JWT_SECRET',
  'CRON_SHARED_SECRET',
]

function loadEnv(source) {
  const env = source || process.env
  const missing = REQUIRED_KEYS.filter((key) => !env[key])
  if (missing.length > 0) {
    throw new Error(`Missing required env var(s): ${missing.join(', ')}`)
  }

  const dbPort = Number(env.DB_PORT)
  if (!Number.isInteger(dbPort)) {
    throw new Error(`DB_PORT must be an integer, got: ${env.DB_PORT}`)
  }

  return {
    nodeEnv: env.NODE_ENV,
    dbHost: env.DB_HOST,
    dbPort,
    dbUser: env.DB_USER,
    dbPassword: env.DB_PASSWORD,
    dbName: env.DB_NAME,
    passwordHash: env.PASSWORD_HASH,
    jwtSecret: env.JWT_SECRET,
    cronSharedSecret: env.CRON_SHARED_SECRET,
  }
}

module.exports = { loadEnv, REQUIRED_KEYS }
