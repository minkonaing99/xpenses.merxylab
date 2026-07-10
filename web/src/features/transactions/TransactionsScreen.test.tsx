import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createXpensesDb, type XpensesDb } from '../../offline/db'
import { TransactionsScreen } from './TransactionsScreen'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status })
}

const TODAY = new Date().toISOString().slice(0, 10)
const THIS_MONTH = TODAY.slice(0, 7)

describe('TransactionsScreen', () => {
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

  it('shows an empty state with no transactions this month', async () => {
    db = createXpensesDb('test-txnscreen-empty')
    render(<TransactionsScreen db={db} />)

    expect(await screen.findByText(/no transactions yet/i)).toBeInTheDocument()
  })

  it('lists this month\'s transactions and computes net (income minus expense, transfers excluded)', async () => {
    db = createXpensesDb('test-txnscreen-net')
    await db.categories.put({ id: 'c1', name: 'Food', icon: null, sortOrder: 0, updatedAt: 'x', deletedAt: null })
    await db.accounts.put({ id: 'a1', name: 'Cash', type: 'cash', startingBalance: 0, balance: 0, sortOrder: 0, updatedAt: 'x', deletedAt: null })
    await db.transactions.bulkPut([
      { id: 't1', type: 'income', amount: 500000, note: 'Payday', categoryId: null, accountId: 'a1', fromAccountId: null, toAccountId: null, txnDate: TODAY, updatedAt: 'x', deletedAt: null },
      { id: 't2', type: 'expense', amount: 20000, note: 'Lunch', categoryId: 'c1', accountId: 'a1', fromAccountId: null, toAccountId: null, txnDate: TODAY, updatedAt: 'x', deletedAt: null },
      { id: 't3', type: 'transfer', amount: 90000, note: '', categoryId: null, accountId: null, fromAccountId: 'a1', toAccountId: 'a1', txnDate: TODAY, updatedAt: 'x', deletedAt: null },
      { id: 't4', type: 'expense', amount: 10000, note: 'Old month', categoryId: 'c1', accountId: 'a1', fromAccountId: null, toAccountId: null, txnDate: `${THIS_MONTH === '2000-01' ? '1999-12' : '2000-01'}-01`, updatedAt: 'x', deletedAt: null },
    ])

    render(<TransactionsScreen db={db} />)

    expect(await screen.findByText('Lunch')).toBeInTheDocument()
    expect(screen.getByText('Payday')).toBeInTheDocument()
    expect(screen.queryByText('Old month')).not.toBeInTheDocument()
    expect(screen.getByText('+฿4,800')).toBeInTheDocument()
  })

  it('opens the add sheet from the FAB and closes it after creating a transaction', async () => {
    db = createXpensesDb('test-txnscreen-add')
    await db.categories.put({ id: 'c1', name: 'Food', icon: null, sortOrder: 0, updatedAt: 'x', deletedAt: null })
    await db.accounts.put({ id: 'a1', name: 'Cash', type: 'cash', startingBalance: 0, balance: 0, sortOrder: 0, updatedAt: 'x', deletedAt: null })
    render(<TransactionsScreen db={db} />)

    await userEvent.click(screen.getByRole('button', { name: /add transaction/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await userEvent.click(await screen.findByRole('button', { name: /cash/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Food' }))
    const amountInput = screen.getByRole('textbox', { name: 'Amount' })
    await userEvent.type(amountInput, '99')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await screen.findByText('Food')).toBeInTheDocument()
  })

  it('opens the edit sheet when a transaction row is tapped', async () => {
    db = createXpensesDb('test-txnscreen-edit')
    await db.categories.put({ id: 'c1', name: 'Food', icon: null, sortOrder: 0, updatedAt: 'x', deletedAt: null })
    await db.accounts.put({ id: 'a1', name: 'Cash', type: 'cash', startingBalance: 0, balance: 0, sortOrder: 0, updatedAt: 'x', deletedAt: null })
    await db.transactions.put({
      id: 't1', type: 'expense', amount: 8600, note: 'Lunch', categoryId: 'c1', accountId: 'a1',
      fromAccountId: null, toAccountId: null, txnDate: TODAY, updatedAt: 'x', deletedAt: null,
    })
    render(<TransactionsScreen db={db} />)

    await userEvent.click(await screen.findByRole('button', { name: /edit lunch/i }))

    expect(screen.getByRole('dialog', { name: /transaction/i })).toBeInTheDocument()
    expect(screen.getByDisplayValue('Lunch')).toBeInTheDocument()
  })
})
