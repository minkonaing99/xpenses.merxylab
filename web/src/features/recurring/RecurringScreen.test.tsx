import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createXpensesDb, type XpensesDb } from '../../offline/db'
import { RecurringScreen } from './RecurringScreen'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status })
}

async function seedRule(db: XpensesDb, overrides: Partial<{ active: boolean }> = {}) {
  await db.accounts.put({ id: 'a1', name: 'Cash', type: 'cash', startingBalance: 0, balance: 0, sortOrder: 0, updatedAt: 'x', deletedAt: null })
  await db.categories.put({ id: 'c1', name: 'Rent', icon: null, sortOrder: 0, updatedAt: 'x', deletedAt: null })
  await db.recurringRules.put({
    id: 'r1', type: 'expense', amount: 1250000, note: null, categoryId: 'c1', accountId: 'a1',
    fromAccountId: null, toAccountId: null, intervalUnit: 'month', intervalCount: 1,
    nextRunDate: '2026-08-01', active: overrides.active ?? true, updatedAt: 'x', deletedAt: null,
  })
}

describe('RecurringScreen', () => {
  let db: XpensesDb

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() =>
        Promise.resolve(jsonResponse({ ok: true, data: { results: [{ id: 'x', status: 'applied' }] } })),
      ),
    )
  })

  afterEach(async () => {
    vi.unstubAllGlobals()
    await db?.delete()
  })

  it('shows an empty state when there are no rules', async () => {
    db = createXpensesDb('test-recscreen-empty')
    render(<RecurringScreen db={db} />)

    expect(await screen.findByText(/no recurring/i)).toBeInTheDocument()
  })

  it('lists a rule with its category and interval', async () => {
    db = createXpensesDb('test-recscreen-list')
    await seedRule(db)
    render(<RecurringScreen db={db} />)

    expect(await screen.findByText('Rent')).toBeInTheDocument()
    expect(screen.getByText(/every month/i)).toBeInTheDocument()
  })

  it('pauses an active rule', async () => {
    db = createXpensesDb('test-recscreen-pause')
    await seedRule(db, { active: true })
    render(<RecurringScreen db={db} />)

    const toggle = await screen.findByRole('button', { name: /pause rent/i })
    await userEvent.click(toggle)

    expect(await screen.findByRole('button', { name: /resume rent/i })).toBeInTheDocument()
    expect((await db.recurringRules.get('r1'))?.active).toBe(false)
  })

  it('resumes a paused rule', async () => {
    db = createXpensesDb('test-recscreen-resume')
    await seedRule(db, { active: false })
    render(<RecurringScreen db={db} />)

    const toggle = await screen.findByRole('button', { name: /resume rent/i })
    await userEvent.click(toggle)

    expect(await screen.findByRole('button', { name: /pause rent/i })).toBeInTheDocument()
    expect((await db.recurringRules.get('r1'))?.active).toBe(true)
  })

  it('shows the next run date in the row', async () => {
    db = createXpensesDb('test-recscreen-nextrun')
    await seedRule(db)
    render(<RecurringScreen db={db} />)

    expect(await screen.findByText(/2026-08-01/)).toBeInTheDocument()
  })

  it('resuming a rule whose next run date is in the past reschedules it to today instead of flooding catch-up transactions', async () => {
    db = createXpensesDb('test-recscreen-resume-stale')
    await db.accounts.put({ id: 'a1', name: 'Cash', type: 'cash', startingBalance: 0, balance: 0, sortOrder: 0, updatedAt: 'x', deletedAt: null })
    await db.categories.put({ id: 'c1', name: 'Rent', icon: null, sortOrder: 0, updatedAt: 'x', deletedAt: null })
    await db.recurringRules.put({
      id: 'r1', type: 'expense', amount: 1250000, note: null, categoryId: 'c1', accountId: 'a1',
      fromAccountId: null, toAccountId: null, intervalUnit: 'month', intervalCount: 1,
      nextRunDate: '2000-01-01', active: false, updatedAt: 'x', deletedAt: null,
    })
    render(<RecurringScreen db={db} />)

    const toggle = await screen.findByRole('button', { name: /resume rent/i })
    await userEvent.click(toggle)

    await screen.findByRole('button', { name: /pause rent/i })
    const updated = await db.recurringRules.get('r1')
    expect(updated?.active).toBe(true)
    expect(updated?.nextRunDate).not.toBe('2000-01-01')
    expect((updated?.nextRunDate ?? '') >= new Date().toISOString().slice(0, 10)).toBe(true)
  })

  it('deletes a rule', async () => {
    db = createXpensesDb('test-recscreen-delete')
    await seedRule(db)
    render(<RecurringScreen db={db} />)

    await screen.findByText('Rent')
    await userEvent.click(screen.getByRole('button', { name: /delete rent/i }))

    expect(await screen.findByText(/no recurring/i)).toBeInTheDocument()
  })

  it('opens the create form from the FAB', async () => {
    db = createXpensesDb('test-recscreen-add')
    render(<RecurringScreen db={db} />)

    await userEvent.click(screen.getByRole('button', { name: /add recurring/i }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
