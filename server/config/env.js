'use strict'

const REQUIRED_KEYS = [
  'NODE_ENV',
  'DB_HOST',
  'DB_PORT',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME',
  'JWT_SECRET',
  'CRON_SHARED_SECRET',
]

// The bcrypt hash is full of "$" chars that some shared-host env panels mangle
// (`$2b`/`$12` read as shell vars). Accept a base64 form (PASSWORD_HASH_B64) as
// a fallback so the hash can always be delivered intact.
function resolvePasswordHash(env) {
  if (env.PASSWORD_HASH) return env.PASSWORD_HASH
  if (env.PASSWORD_HASH_B64) return Buffer.from(env.PASSWORD_HASH_B64, 'base64').toString('utf8')
  return undefined
}

function loadEnv(source) {
  const env = source || process.env
  const missing = REQUIRED_KEYS.filter((key) => !env[key])
  if (missing.length > 0) {
    throw new Error(`Missing required env var(s): ${missing.join(', ')}`)
  }

  const passwordHash = resolvePasswordHash(env)
  if (!passwordHash) {
    throw new Error('Missing required env var(s): PASSWORD_HASH (or PASSWORD_HASH_B64)')
  }

  const dbPort = Number(env.DB_PORT)
  if (!Number.isInteger(dbPort)) {
    throw new Error(`DB_PORT must be an integer, got: ${env.DB_PORT}`)
  }

  // Optional: enables Bearer-token auth for the MCP server / programmatic
  // clients. Enforce a floor so a weak token can't be brute-forced.
  const apiToken = env.API_TOKEN
  if (apiToken !== undefined && apiToken.length < 24) {
    throw new Error('API_TOKEN must be at least 24 characters')
  }

  return {
    nodeEnv: env.NODE_ENV,
    dbHost: env.DB_HOST,
    dbPort,
    dbUser: env.DB_USER,
    dbPassword: env.DB_PASSWORD,
    dbName: env.DB_NAME,
    passwordHash,
    jwtSecret: env.JWT_SECRET,
    cronSharedSecret: env.CRON_SHARED_SECRET,
    apiToken,
  }
}

module.exports = { loadEnv, REQUIRED_KEYS }
