'use strict'

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
