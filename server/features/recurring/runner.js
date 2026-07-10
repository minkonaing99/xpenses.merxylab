'use strict'

const { randomUUID } = require('crypto')
const { planDueRuns } = require('./scheduler')
const repo = require('./repo')

function buildTransactionFromRule(rule, runDate) {
  return {
    id: randomUUID(),
    type: rule.type,
    amount: rule.amount,
    note: rule.note,
    categoryId: rule.category_id,
    accountId: rule.account_id,
    fromAccountId: rule.from_account_id,
    toAccountId: rule.to_account_id,
    txnDate: runDate,
  }
}

// Atomic per-run-date guard: the (rule_id, run_date) PK on recurring_runs
// is the real idempotency mechanism — if two cron ticks race (or a retry
// replays a run_date already processed), the second INSERT hits a duplicate
// key and rolls back cleanly instead of double-inserting the transaction.
async function insertRunAndTransaction(pool, ruleId, runDate, txn) {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    try {
      await conn.query('INSERT INTO recurring_runs (rule_id, run_date, transaction_id) VALUES (?, ?, ?)', [
        ruleId,
        runDate,
        txn.id,
      ])
    } catch (err) {
      await conn.rollback()
      if (err.code === 'ER_DUP_ENTRY') return { inserted: false }
      throw err
    }

    await conn.query(
      `INSERT INTO transactions
         (id, type, amount, note, category_id, account_id, from_account_id, to_account_id, txn_date, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        txn.id,
        txn.type,
        txn.amount,
        txn.note ?? null,
        txn.categoryId ?? null,
        txn.accountId ?? null,
        txn.fromAccountId ?? null,
        txn.toAccountId ?? null,
        txn.txnDate,
      ],
    )
    await conn.commit()
    return { inserted: true }
  } finally {
    conn.release()
  }
}

// One rule's next_run_date only advances after its due run_dates are
// attempted — if a genuine error aborts partway through, next_run_date
// stays put and the next cron tick retries; already-inserted run_dates are
// skipped harmlessly by the guard above (no double-processing).
async function processRule(pool, rule, today) {
  const { runDates, nextRunDate } = planDueRuns(
    { intervalUnit: rule.interval_unit, intervalCount: rule.interval_count, nextRunDate: rule.next_run_date },
    today,
  )

  let runsInserted = 0
  for (const runDate of runDates) {
    const result = await insertRunAndTransaction(pool, rule.id, runDate, buildTransactionFromRule(rule, runDate))
    if (result.inserted) runsInserted++
  }

  if (runDates.length > 0) {
    await repo.update(pool, rule.id, { nextRunDate })
  }

  return { ruleId: rule.id, runsPlanned: runDates.length, runsInserted }
}

async function runCronOnce(pool, today) {
  const dueRules = await repo.findDue(pool, today)
  const results = []

  for (const rule of dueRules) {
    try {
      results.push(await processRule(pool, rule, today))
    } catch (err) {
      console.error(`Recurring rule ${rule.id} failed:`, err)
      results.push({ ruleId: rule.id, error: err.message })
    }
  }

  return results
}

module.exports = { runCronOnce, processRule }
