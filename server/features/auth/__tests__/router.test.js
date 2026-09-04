'use strict'

const express = require('express')
const cookieParser = require('cookie-parser')
const bcrypt = require('bcrypt')
const request = require('supertest')
const { createAuthRouter } = require('../router')
const errorHandler = require('../../../middleware/error')

const PASSWORD = 'correct-horse-battery-staple'
const JWT_SECRET = 'test-secret'

async function buildApp(rateLimitOverrides) {
  const passwordHash = await bcrypt.hash(PASSWORD, 4)
  const app = express()
  app.use(express.json())
  app.use(cookieParser())
  app.use(
    '/api/auth',
    createAuthRouter({ passwordHash, jwtSecret: JWT_SECRET, nodeEnv: 'test', rateLimit: rateLimitOverrides }),
  )
  app.use(errorHandler)
  return app
}

describe('POST /api/auth/login', () => {
  it('sets an httpOnly session cookie and returns ok on a correct password', async () => {
    const app = await buildApp()
    const res = await request(app).post('/api/auth/login').send({ password: PASSWORD })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true, data: {}, meta: {} })
    const cookie = res.headers['set-cookie'][0]
    expect(cookie).toMatch(/xpenses_token=/)
    expect(cookie).toMatch(/HttpOnly/)
    expect(cookie).toMatch(/SameSite=Lax/)
  })

  it('returns 401 UNAUTHORIZED on a wrong password', async () => {
    const app = await buildApp()
    const res = await request(app).post('/api/auth/login').send({ password: 'wrong' })

    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('UNAUTHORIZED')
  })

  it('returns 400 VALIDATION_ERROR when password is missing', async () => {
    const app = await buildApp()
    const res = await request(app).post('/api/auth/login').send({})

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rate-limits repeated login attempts', async () => {
    const app = await buildApp({ windowMs: 60_000, max: 3 })

    for (let i = 0; i < 3; i++) {
      await request(app).post('/api/auth/login').send({ password: 'wrong' })
    }
    const res = await request(app).post('/api/auth/login').send({ password: 'wrong' })

    expect(res.status).toBe(429)
    expect(res.body.error.code).toBe('RATE_LIMITED')
  })
})

describe('GET /api/auth/me', () => {
  it('returns 401 without a session cookie', async () => {
    const app = await buildApp()
    const res = await request(app).get('/api/auth/me')
    expect(res.status).toBe(401)
  })

  it('returns 200 with a valid session cookie from login', async () => {
    const app = await buildApp()
    const agent = request.agent(app)
    await agent.post('/api/auth/login').send({ password: PASSWORD })

    const res = await agent.get('/api/auth/me')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true, data: { authenticated: true }, meta: {} })
  })
})

describe('POST /api/auth/logout', () => {
  it('clears the session cookie so a later /me is unauthenticated', async () => {
    const app = await buildApp()
    const agent = request.agent(app)
    await agent.post('/api/auth/login').send({ password: PASSWORD })

    const logoutRes = await agent.post('/api/auth/logout')
    expect(logoutRes.status).toBe(200)

    const meRes = await agent.get('/api/auth/me')
    expect(meRes.status).toBe(401)
  })

  it.each([
    ['without a session', undefined],
    ['with an invalid session', 'xpenses_token=invalid'],
  ])('clears the cookie %s', async (_label, cookie) => {
    const app = await buildApp()
    const req = request(app).post('/api/auth/logout')
    if (cookie) req.set('Cookie', cookie)
    const res = await req

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true, data: {}, meta: {} })
    expect(res.headers['set-cookie'][0]).toMatch(
      /^xpenses_token=; Path=\/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax$/,
    )
  })
})
