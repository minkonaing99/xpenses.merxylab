'use strict'

jest.mock('mysql2/promise', () => ({
  createPool: jest.fn(() => ({ mocked: true })),
}))

const mysql = require('mysql2/promise')
const { createPool } = require('../pool')

describe('createPool', () => {
  it('creates a mysql2 promise pool from the given db config', () => {
    createPool({
      dbHost: 'localhost',
      dbPort: 3306,
      dbUser: 'root',
      dbPassword: 'secret',
      dbName: 'xpense',
    })

    expect(mysql.createPool).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'localhost',
        port: 3306,
        user: 'root',
        password: 'secret',
        database: 'xpense',
        waitForConnections: true,
        dateStrings: true,
      }),
    )
  })
})
