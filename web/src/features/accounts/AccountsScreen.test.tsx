import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createXpensesDb, type XpensesDb } from '../../offline/db'
import { AccountsScreen } from './AccountsScreen'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status })
}

describe('AccountsScreen', () => {
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

  it('shows an empty state when there are no accounts', async () => {
    db = createXpensesDb('test-accountsscreen-empty')
    render(<AccountsScreen db={db} />)

    expect(await screen.findByText(/no accounts yet/i)).toBeInTheDocument()
  })

  it('lists existing accounts with their balance', async () => {
    db = createXpensesDb('test-accountsscreen-list')
    await db.accounts.put({ id: 'a1', name: 'Cash', type: 'cash', startingBalance: 0, balance: 64200, sortOrder: 0, updatedAt: 'x', deletedAt: null })
    render(<AccountsScreen db={db} />)

    // 'Cash' also matches the account-type chip, so target the delete
    // button (unique per account row) plus the formatted balance.
    expect(await screen.findByRole('button', { name: /delete cash/i })).toBeInTheDocument()
    expect(screen.getByText('฿642')).toBeInTheDocument()
  })

  it('adds a new account', async () => {
    db = createXpensesDb('test-accountsscreen-add')
    render(<AccountsScreen db={db} />)

    await userEvent.type(screen.getByLabelText(/account name/i), 'Savings')
    await userEvent.click(screen.getByRole('button', { name: /add/i }))

    expect(await screen.findByRole('button', { name: /delete savings/i })).toBeInTheDocument()
  })

  it('deletes an account', async () => {
    db = createXpensesDb('test-accountsscreen-delete')
    await db.accounts.put({ id: 'a1', name: 'Cash', type: 'cash', startingBalance: 0, balance: 0, sortOrder: 0, updatedAt: 'x', deletedAt: null })
    render(<AccountsScreen db={db} />)

    const deleteButton = await screen.findByRole('button', { name: /delete cash/i })
    await userEvent.click(deleteButton)

    expect(await screen.findByText(/no accounts yet/i)).toBeInTheDocument()
  })

  it('blocks deleting an account still referenced by transactions and shows why', async () => {
    db = createXpensesDb('test-accountsscreen-delete-blocked')
    await db.accounts.put({ id: 'a1', name: 'Cash', type: 'cash', startingBalance: 0, balance: 0, sortOrder: 0, updatedAt: 'x', deletedAt: null })
    await db.transactions.put({
      id: 't1', type: 'expense', amount: 100, note: null, categoryId: null, accountId: 'a1',
      fromAccountId: null, toAccountId: null, txnDate: '2026-07-01', updatedAt: 'x', deletedAt: null,
    })
    render(<AccountsScreen db={db} />)

    const deleteButton = await screen.findByRole('button', { name: /delete cash/i })
    await userEvent.click(deleteButton)

    expect(await screen.findByText(/used by 1 transaction/i)).toBeInTheDocument()
    expect(await db.accounts.get('a1')).not.toBeUndefined()
    expect((await db.accounts.get('a1'))?.deletedAt).toBeNull()
  })
})
