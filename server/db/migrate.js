'use strict'

const fs = require('fs')
const path = require('path')
const mysql = require('mysql2/promise')
const { loadEnv } = require('../config/env')

const MIGRATIONS_DIR = path.join(__dirname, 'migrations')

function splitStatements(sql) {
  return sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0)
}

function pendingMigrations(files, appliedVersions) {
  return files.filter((file) => !appliedVersions.has(file)).sort()
}

async function ensureMigrationsTable(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version     VARCHAR(255) NOT NULL,
      applied_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (version)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
}

async function runMigrations() {
  const env = loadEnv()
  const connection = await mysql.createConnection({
    host: env.dbHost,
    port: env.dbPort,
    user: env.dbUser,
    password: env.dbPassword,
    database: env.dbName,
  })

  try {
    await ensureMigrationsTable(connection)

    const [rows] = await connection.query('SELECT version FROM schema_migrations')
    const applied = new Set(rows.map((row) => row.version))

    const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'))
    const pending = pendingMigrations(files, applied)

    for (const file of pending) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8')
      const statements = splitStatements(sql)

      for (const statement of statements) {
        await connection.query(statement)
      }
      await connection.query('INSERT INTO schema_migrations (version) VALUES (?)', [file])
      console.log(`Applied migration: ${file}`)
    }

    if (pending.length === 0) {
      console.log('No pending migrations.')
    }
  } finally {
    await connection.end()
  }
}

if (require.main === module) {
  runMigrations().catch((err) => {
    console.error('Migration failed:', err.message)
    process.exitCode = 1
  })
}

module.exports = { splitStatements, pendingMigrations, runMigrations }
