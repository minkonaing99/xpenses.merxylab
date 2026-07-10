'use strict'

function snakeToCamelKey(key) {
  return key.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase())
}

function rowToCamel(row) {
  if (row == null) return row
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [snakeToCamelKey(key), value]))
}

module.exports = { rowToCamel }
