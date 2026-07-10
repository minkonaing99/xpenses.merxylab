'use strict'

const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const TOKEN_TTL = '7d'

function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash)
}

function signToken(jwtSecret) {
  return jwt.sign({ sub: 'owner' }, jwtSecret, { expiresIn: TOKEN_TTL, algorithm: 'HS256' })
}

module.exports = { verifyPassword, signToken, TOKEN_TTL }
