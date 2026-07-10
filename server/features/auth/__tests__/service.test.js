'use strict'

const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const { verifyPassword, signToken } = require('../service')

describe('verifyPassword', () => {
  it('resolves true when the password matches the hash', async () => {
    const hash = await bcrypt.hash('correct-horse', 4)
    await expect(verifyPassword('correct-horse', hash)).resolves.toBe(true)
  })

  it('resolves false when the password does not match', async () => {
    const hash = await bcrypt.hash('correct-horse', 4)
    await expect(verifyPassword('wrong-password', hash)).resolves.toBe(false)
  })
})

describe('signToken', () => {
  it('signs a verifiable JWT with the given secret', () => {
    const token = signToken('test-secret')
    const decoded = jwt.verify(token, 'test-secret')
    expect(decoded.sub).toBe('owner')
  })
})
