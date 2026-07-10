'use strict'

const { randomUUID } = require('crypto')
const express = require('express')
const request = require('supertest')
const { getPool } = require('../../../db/pool')
const { createCategoriesRouter } = require('../router')
const errorHandler = require('../../../middleware/error')

const pool = getPool()

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/categories', createCategoriesRouter(pool))
  app.use(errorHandler)
  return app
}

afterAll(async () => {
  await pool.end()
})

describe('categories router', () => {
  let app
  let categoryId

  beforeEach(() => {
    app = buildApp()
    categoryId = randomUUID()
  })

  afterEach(async () => {
    await pool.query('DELETE FROM transactions WHERE category_id = ?', [categoryId])
    await pool.query('DELETE FROM budgets WHERE category_id = ?', [categoryId])
    await pool.query('DELETE FROM categories WHERE id = ?', [categoryId])
  })

  it('POST creates a category, GET / lists it', async () => {
    const createRes = await request(app)
      .post('/api/categories')
      .send({ id: categoryId, name: `Router Test ${categoryId}`, icon: 'tag' })
    expect(createRes.status).toBe(201)

    const listRes = await request(app).get('/api/categories')
    expect(listRes.body.data.find((c) => c.id === categoryId)).toMatchObject({ icon: 'tag' })
  })

  it('POST rejects a missing name with 400 VALIDATION_ERROR', async () => {
    const res = await request(app).post('/api/categories').send({ id: categoryId })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('POST returns 409 CONFLICT for a duplicate name', async () => {
    const name = `Dup ${categoryId}`
    await request(app).post('/api/categories').send({ id: categoryId, name })
    const res = await request(app).post('/api/categories').send({ id: randomUUID(), name })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('CONFLICT')
  })

  it('PATCH updates a field, 404 for an unknown id', async () => {
    await request(app).post('/api/categories').send({ id: categoryId, name: `Original ${categoryId}` })
    const patchRes = await request(app).patch(`/api/categories/${categoryId}`).send({ icon: 'star' })
    expect(patchRes.status).toBe(200)
    expect(patchRes.body.data.icon).toBe('star')

    const notFoundRes = await request(app).patch(`/api/categories/${randomUUID()}`).send({ icon: 'x' })
    expect(notFoundRes.status).toBe(404)
  })

  it('DELETE soft-deletes an unreferenced category', async () => {
    await request(app).post('/api/categories').send({ id: categoryId, name: `Delete Me ${categoryId}` })
    const res = await request(app).delete(`/api/categories/${categoryId}`)
    expect(res.status).toBe(200)

    const listRes = await request(app).get('/api/categories')
    expect(listRes.body.data.find((c) => c.id === categoryId)).toBeUndefined()
  })

  it('allows reusing a deleted category name (regression: migration 003)', async () => {
    const name = `Reusable ${categoryId}`
    await request(app).post('/api/categories').send({ id: categoryId, name })
    await request(app).delete(`/api/categories/${categoryId}`)

    const secondId = randomUUID()
    const res = await request(app).post('/api/categories').send({ id: secondId, name })
    expect(res.status).toBe(201)

    await pool.query('DELETE FROM categories WHERE id = ?', [secondId])
  })

  it('PATCH returns 409 CONFLICT when renaming to another active category\'s name', async () => {
    const otherId = randomUUID()
    const otherName = `Other ${categoryId}`
    await request(app).post('/api/categories').send({ id: categoryId, name: `Original ${categoryId}` })
    await request(app).post('/api/categories').send({ id: otherId, name: otherName })

    const res = await request(app).patch(`/api/categories/${categoryId}`).send({ name: otherName })
    expect(res.status).toBe(409)

    await pool.query('DELETE FROM categories WHERE id = ?', [otherId])
  })

  it('DELETE returns 409 CONFLICT when referenced by a transaction', async () => {
    await request(app).post('/api/categories').send({ id: categoryId, name: `Referenced ${categoryId}` })
    await pool.query(
      `INSERT INTO transactions (id, type, amount, category_id, account_id, txn_date, updated_at)
       VALUES (?, 'expense', 100, ?, NULL, CURDATE(), NOW())`,
      [randomUUID(), categoryId],
    )

    const res = await request(app).delete(`/api/categories/${categoryId}`)
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('CONFLICT')
  })
})
