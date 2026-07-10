'use strict'

// MySQL DATETIME rejects ISO 8601's 'T'/'Z'/offset syntax — convert to
// 'YYYY-MM-DD HH:MM:SS' in UTC (see docs/SCHEMA.md "Timestamps stored UTC").
function toMysqlDatetime(isoString) {
  return new Date(isoString).toISOString().slice(0, 19).replace('T', ' ')
}

module.exports = { toMysqlDatetime }
