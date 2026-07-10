'use strict'

// Integration tests hit a real DB (project convention: no mocking the
// database) — always the disposable xpense_test DB, never the dev DB.
require('dotenv').config({ path: '.env.test', quiet: true })
