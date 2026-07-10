'use strict'

const mysql = require('mysql2/promise')
const { loadEnv } = require('../config/env')

function createPool({ dbHost, dbPort, dbUser, dbPassword, dbName }) {
  return mysql.createPool({
    host: dbHost,
    port: dbPort,
    user: dbUser,
    password: dbPassword,
    database: dbName,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    // Return DATE/DATETIME as raw strings, not JS Date objects — Date
    // objects apply local-timezone conversion, which can shift a DATE
    // column (e.g. txn_date) to the wrong calendar day.
    dateStrings: true,
  })
}

let pool

function getPool() {
  if (!pool) {
    pool = createPool(loadEnv())
  }
  return pool
}

module.exports = { createPool, getPool }
