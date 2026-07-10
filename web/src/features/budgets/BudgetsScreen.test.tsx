import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createXpensesDb, type XpensesDb } from '../../offline/db'
import { BudgetsScreen } from './BudgetsScreen'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status })
}

async function seedCategory(db: XpensesDb) {
  await db.categories.put({ id: 'c1', name: 'Groceries', icon: null, sortOrder: 0, updatedAt: 'x', deletedAt: null })
}

describe('BudgetsScreen', () => {
  let db: XpensesDb
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn().mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('/api/budgets')) {
        return Promise.resolve(jsonResponse({ ok: true, data: [] }))
      }
      return Promise.resolve(jsonResponse({ ok: true, data: { results: [{ id: 'x', status: 'applied' }] } }))
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(async () => {
    vi.unstubAllGlobals()
    await db?.delete()
  })

  it('shows an empty state when there are no budgets', async () => {
    db = createXpensesDb('test-budgetsscreen-empty')
    render(<BudgetsScreen db={db} />)

    expect(await screen.findByText(/no budgets yet/i)).toBeInTheDocument()
  })

  it('adds a new budget for a category', async () => {
    db = createXpensesDb('test-budgetsscreen-add')
    await seedCategory(db)
    render(<BudgetsScreen db={db} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Groceries' }))
    const amountInput = screen.getByRole('textbox', { name: 'Amount' })
    await userEvent.type(amountInput, '600')
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))

    expect(await screen.findByText(/฿0 \/ ฿600/)).toBeInTheDocument()
  })

  it('shows spent/over from the live API response, not just the cached limit', async () => {
    db = createXpensesDb('test-budgetsscreen-live')
    await seedCategory(db)
    await db.budgets.put({ id: 'b1', categoryId: 'c1', limitAmount: 60000, updatedAt: 'x', deletedAt: null })
    fetchMock.mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('/api/budgets')) {
        return Promise.resolve(
          jsonResponse({
            ok: true,
            data: [{ id: 'b1', categoryId: 'c1', limitAmount: 60000, spent: 64200, over: true, updatedAt: 'x', deletedAt: null }],
          }),
        )
      }
      return Promise.resolve(jsonResponse({ ok: true, data: { results: [] } }))
    })

    render(<BudgetsScreen db={db} />)

    expect(await screen.findByText(/฿642 \/ ฿600/)).toBeInTheDocument()
    expect(await screen.findByText(/groceries is ฿42 over budget/i)).toBeInTheDocument()
  })

  it('deletes a budget', async () => {
    db = createXpensesDb('test-budgetsscreen-delete')
    await seedCategory(db)
    await db.budgets.put({ id: 'b1', categoryId: 'c1', limitAmount: 60000, updatedAt: 'x', deletedAt: null })
    render(<BudgetsScreen db={db} />)

    const deleteButton = await screen.findByRole('button', { name: /delete groceries budget/i })
    await userEvent.click(deleteButton)

    expect(await screen.findByText(/no budgets yet/i)).toBeInTheDocument()
  })

  it('edits a budget limit by tapping the row', async () => {
    db = createXpensesDb('test-budgetsscreen-edit')
    await seedCategory(db)
    await db.budgets.put({ id: 'b1', categoryId: 'c1', limitAmount: 60000, updatedAt: 'x', deletedAt: null })
    render(<BudgetsScreen db={db} />)

    await userEvent.click(await screen.findByRole('button', { name: /edit groceries budget/i }))
    const amountInput = screen.getByRole('textbox', { name: 'Amount' })
    await userEvent.clear(amountInput)
    await userEvent.type(amountInput, '800')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText(/฿0 \/ ฿800/)).toBeInTheDocument()
  })

  it('shows a Cancel button in edit mode that backs out without saving', async () => {
    db = createXpensesDb('test-budgetsscreen-cancel')
    await seedCategory(db)
    await db.budgets.put({ id: 'b1', categoryId: 'c1', limitAmount: 60000, updatedAt: 'x', deletedAt: null })
    render(<BudgetsScreen db={db} />)

    await userEvent.click(await screen.findByRole('button', { name: /edit groceries budget/i }))
    const amountInput = screen.getByRole('textbox', { name: 'Amount' })
    await userEvent.clear(amountInput)
    await userEvent.type(amountInput, '999')
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument()
    expect(await screen.findByText(/฿0 \/ ฿600/)).toBeInTheDocument()
  })

  it('periodically refetches live spent/over even without a local budget mutation', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    db = createXpensesDb('test-budgetsscreen-poll')
    await seedCategory(db)
    await db.budgets.put({ id: 'b1', categoryId: 'c1', limitAmount: 60000, updatedAt: 'x', deletedAt: null })
    let spent = 0
    fetchMock.mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('/api/budgets')) {
        return Promise.resolve(
          jsonResponse({
            ok: true,
            data: [{ id: 'b1', categoryId: 'c1', limitAmount: 60000, spent, over: spent > 60000, updatedAt: 'x', deletedAt: null }],
          }),
        )
      }
      return Promise.resolve(jsonResponse({ ok: true, data: { results: [] } }))
    })

    render(<BudgetsScreen db={db} />)
    await screen.findByText(/฿0 \/ ฿600/)

    // A transaction elsewhere changed spend server-side — nothing in the
    // local budgets table changed, so only a poll (not the cachedBudgets
    // dependency) can pick this up.
    spent = 64200
    await vi.advanceTimersByTimeAsync(30_000)

    expect(await screen.findByText(/฿642 \/ ฿600/)).toBeInTheDocument()
    vi.useRealTimers()
  })
})
