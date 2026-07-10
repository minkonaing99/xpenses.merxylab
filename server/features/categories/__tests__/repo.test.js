'use strict'

const { randomUUID } = require('crypto')
const { getPool } = require('../../../db/pool')
const repo = require('../repo')

const pool = getPool()

afterAll(async () => {
  await pool.end()
})

describe('categories repo', () => {
  let categoryId

  beforeEach(async () => {
    categoryId = randomUUID()
    await repo.create(pool, { id: categoryId, name: `Test Category ${categoryId}`, icon: 'tag', sortOrder: 50 })
  })

  afterEach(async () => {
    await pool.query('DELETE FROM transactions WHERE category_id = ?', [categoryId])
    await pool.query('DELETE FROM budgets WHERE category_id = ?', [categoryId])
    await pool.query('DELETE FROM categories WHERE id = ?', [categoryId])
  })

  it('creates and finds a category by id', async () => {
    const found = await repo.findById(pool, categoryId)
    expect(found).toMatchObject({ id: categoryId, icon: 'tag', sort_order: 50 })
  })

  it('returns null for a non-existent id', async () => {
    expect(await repo.findById(pool, randomUUID())).toBeNull()
  })

  it('findAll includes the created category', async () => {
    const rows = await repo.findAll(pool)
    expect(rows.some((r) => r.id === categoryId)).toBe(true)
  })

  it('updates only the given fields', async () => {
    await repo.update(pool, categoryId, { icon: 'star' })
    const found = await repo.findById(pool, categoryId)
    expect(found.icon).toBe('star')
  })

  it('soft-deletes, excluding it from findById and findAll', async () => {
    await repo.softDelete(pool, categoryId)
    expect(await repo.findById(pool, categoryId)).toBeNull()
    const rows = await repo.findAll(pool)
    expect(rows.some((r) => r.id === categoryId)).toBe(false)
  })

  it('countReferences counts both transactions and budgets referencing the category', async () => {
    expect(await repo.countReferences(pool, categoryId)).toBe(0)

    await pool.query(
      `INSERT INTO transactions (id, type, amount, category_id, account_id, txn_date, updated_at)
       VALUES (?, 'expense', 100, ?, NULL, CURDATE(), NOW())`,
      [randomUUID(), categoryId],
    )
    expect(await repo.countReferences(pool, categoryId)).toBe(1)

    await pool.query(`INSERT INTO budgets (id, category_id, limit_amount) VALUES (?, ?, 5000)`, [
      randomUUID(),
      categoryId,
    ])
    expect(await repo.countReferences(pool, categoryId)).toBe(2)
  })

  it('findActiveByName finds a non-deleted category by exact name', async () => {
    const found = await repo.findActiveByName(pool, `Test Category ${categoryId}`)
    expect(found.id).toBe(categoryId)
  })

  it('findActiveByName excludes the given id (for PATCH self-comparison)', async () => {
    expect(await repo.findActiveByName(pool, `Test Category ${categoryId}`, categoryId)).toBeNull()
  })

  it('findActiveByName returns null once the category is soft-deleted — name is free again', async () => {
    const name = `Test Category ${categoryId}`
    await repo.softDelete(pool, categoryId)
    expect(await repo.findActiveByName(pool, name)).toBeNull()
  })

  it('findChangedSince includes rows updated after the given timestamp, incl. tombstones', async () => {
    const before = await repo.findChangedSince(pool, '2000-01-01 00:00:00')
    expect(before.some((r) => r.id === categoryId)).toBe(true)

    await repo.softDelete(pool, categoryId)
    const afterDelete = await repo.findChangedSince(pool, '2000-01-01 00:00:00')
    expect(afterDelete.find((r) => r.id === categoryId).deleted_at).not.toBeNull()
  })
})
