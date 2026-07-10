import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createXpensesDb, type XpensesDb } from '../../offline/db'
import { RecurringForm } from './RecurringForm'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status })
}

async function seedRefs(db: XpensesDb) {
  await db.accounts.put({ id: 'a1', name: 'Cash', type: 'cash', startingBalance: 0, balance: 0, sortOrder: 0, updatedAt: 'x', deletedAt: null })
  await db.categories.put({ id: 'c1', name: 'Rent', icon: null, sortOrder: 0, updatedAt: 'x', deletedAt: null })
}

describe('RecurringForm', () => {
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

  it('calls onClose when Cancel is tapped', async () => {
    db = createXpensesDb('test-recform-cancel')
    await seedRefs(db)
    const onClose = vi.fn()
    render(<RecurringForm db={db} onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('disables Save until amount, account, category, and next run date are set for an expense rule', async () => {
    db = createXpensesDb('test-recform-invalid')
    await seedRefs(db)
    render(<RecurringForm db={db} onClose={() => {}} />)
    expect(await screen.findByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('creates a monthly expense recurring rule', async () => {
    db = createXpensesDb('test-recform-create')
    await seedRefs(db)
    const onClose = vi.fn()
    render(<RecurringForm db={db} onClose={onClose} />)

    await userEvent.click(await screen.findByRole('button', { name: /cash/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Rent' }))
    const amountInput = screen.getByRole('textbox', { name: 'Amount' })
    await userEvent.type(amountInput, '12500')
    const dateInput = screen.getByLabelText(/next run date/i)
    await userEvent.type(dateInput, '2026-08-01')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await vi.waitFor(() => expect(onClose).toHaveBeenCalledOnce())
    const created = await db.recurringRules.toArray()
    expect(created).toHaveLength(1)
    expect(created[0]).toMatchObject({
      type: 'expense', amount: 1250000, categoryId: 'c1', accountId: 'a1',
      intervalUnit: 'month', intervalCount: 1, nextRunDate: '2026-08-01', active: true,
    })
  })

  it('disables Save when the next run date is in the past (server would flood-generate every missed occurrence)', async () => {
    db = createXpensesDb('test-recform-pastdate')
    await seedRefs(db)
    render(<RecurringForm db={db} onClose={() => {}} />)

    await userEvent.click(await screen.findByRole('button', { name: /cash/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Rent' }))
    const amountInput = screen.getByRole('textbox', { name: 'Amount' })
    await userEvent.type(amountInput, '12500')
    const dateInput = screen.getByLabelText(/next run date/i)
    await userEvent.type(dateInput, '2000-01-01')

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('truncates a non-integer interval count instead of persisting a decimal', async () => {
    db = createXpensesDb('test-recform-decimal-interval')
    await seedRefs(db)
    const onClose = vi.fn()
    render(<RecurringForm db={db} onClose={onClose} />)

    await userEvent.click(await screen.findByRole('button', { name: /cash/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Rent' }))
    const amountInput = screen.getByRole('textbox', { name: 'Amount' })
    await userEvent.type(amountInput, '12500')
    const intervalInput = screen.getByLabelText('Interval count')
    await userEvent.clear(intervalInput)
    await userEvent.type(intervalInput, '1.5')
    const dateInput = screen.getByLabelText(/next run date/i)
    await userEvent.type(dateInput, '2026-08-01')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await vi.waitFor(() => expect(onClose).toHaveBeenCalledOnce())
    const created = await db.recurringRules.toArray()
    expect(Number.isInteger(created[0].intervalCount)).toBe(true)
  })

  it('disables Save when the selected account was soft-deleted mid-session', async () => {
    db = createXpensesDb('test-recform-stale-account')
    await seedRefs(db)
    render(<RecurringForm db={db} onClose={() => {}} />)

    await userEvent.click(await screen.findByRole('button', { name: /cash/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Rent' }))
    await db.accounts.update('a1', { deletedAt: '2026-07-10 09:00:00' })
    const amountInput = screen.getByRole('textbox', { name: 'Amount' })
    await userEvent.type(amountInput, '12500')
    const dateInput = screen.getByLabelText(/next run date/i)
    await userEvent.type(dateInput, '2026-08-01')

    expect(await screen.findByRole('button', { name: 'Save' })).toBeDisabled()
  })
})
