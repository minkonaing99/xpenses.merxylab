'use strict'

// Local-only listener. app.js stays Passenger-clean (no .listen()) per
// docs/TECH.md ADR; this is the dev-only entry point `npm run dev` uses.
const app = require('./app')

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`xpenses server listening on http://localhost:${PORT}`)
})
