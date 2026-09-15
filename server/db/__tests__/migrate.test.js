'use strict'

const fs = require('fs')
const path = require('path')
const { splitStatements, pendingMigrations } = require('../migrate')

describe('splitStatements', () => {
  it('splits a SQL file into individual statements, dropping comments and blanks', () => {
    const sql = `
-- a comment
CREATE TABLE a (id INT);

CREATE TABLE b (id INT);
`
    expect(splitStatements(sql)).toEqual(['CREATE TABLE a (id INT)', 'CREATE TABLE b (id INT)'])
  })

  it('returns an empty array for a comment-only file', () => {
    expect(splitStatements('-- nothing here\n')).toEqual([])
  })
})

describe('pendingMigrations', () => {
  it('returns files not yet in the applied set, in filename order', () => {
    const files = ['002_seed.sql', '001_init.sql', '003_budgets.sql']
    const applied = new Set(['001_init.sql'])
    expect(pendingMigrations(files, applied)).toEqual(['002_seed.sql', '003_budgets.sql'])
  })

  it('returns an empty array when everything is already applied', () => {
    const files = ['001_init.sql']
    const applied = new Set(['001_init.sql'])
    expect(pendingMigrations(files, applied)).toEqual([])
  })
})

it('keeps balance-check migration executable without delimiter directives', () => {
  const sql = fs.readFileSync(path.join(__dirname, '../migrations/006_balance_checks.sql'), 'utf8')
  const statements = splitStatements(sql)
  expect(statements).toHaveLength(5)
  expect(statements.filter((statement) => statement.startsWith('CREATE TRIGGER'))).toHaveLength(3)
})

it('keeps adjustment migration to two portable statements', () => {
  const sql = fs.readFileSync(path.join(__dirname, '../migrations/007_reconciliation_adjustments.sql'), 'utf8')
  expect(splitStatements(sql)).toHaveLength(2)
})
