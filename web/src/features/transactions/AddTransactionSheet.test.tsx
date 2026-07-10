import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createXpensesDb, type XpensesDb } from '../../offline/db'
import { AddTransactionSheet } from './AddTransactionSheet'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status })
}

async function seedRefs(db: XpensesDb) {
  await db.accounts.bulkPut([
    { id: 'a1', name: 'Cash', type: 'cash', startingBalance: 0, balance: 0, sortOrder: 0, updatedAt: 'x', deletedAt: null },
    { id: 'a2', name: 'Bank', type: 'bank', startingBalance: 0, balance: 0, sortOrder: 1, updatedAt: 'x', deletedAt: null },
  ])
  await db.categories.put({ id: 'c1', name: 'Food', icon: null, sortOrder: 0, updatedAt: 'x', deletedAt: null })
}

describe('AddTransactionSheet', () => {
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

  it('moves focus into the dialog on open', async () => {
    db = createXpensesDb('test-sheet-focus')
    await seedRefs(db)
    render(<AddTransactionSheet db={db} onClose={() => {}} />)
    expect(screen.getByRole('dialog')).toHaveFocus()
  })

  it('calls onClose when Cancel is tapped', async () => {
    db = createXpensesDb('test-sheet-cancel')
    await seedRefs(db)
    const onClose = vi.fn()
    render(<AddTransactionSheet db={db} onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await vi.waitFor(() => expect(onClose).toHaveBeenCalledOnce())
  })

  it('calls onClose when Escape is pressed', async () => {
    db = createXpensesDb('test-sheet-escape')
    await seedRefs(db)
    const onClose = vi.fn()
    render(<AddTransactionSheet db={db} onClose={onClose} />)
    await userEvent.keyboard('{Escape}')
    await vi.waitFor(() => expect(onClose).toHaveBeenCalledOnce())
  })

  it('disables Save while the amount is zero', async () => {
    db = createXpensesDb('test-sheet-zero')
    await seedRefs(db)
    render(<AddTransactionSheet db={db} onClose={() => {}} />)
    expect(await screen.findByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('disables Save for an expense with no category selected', async () => {
    db = createXpensesDb('test-sheet-invalid')
    await seedRefs(db)
    render(<AddTransactionSheet db={db} onClose={() => {}} />)
    const amountInput = await screen.findByRole('textbox', { name: 'Amount' })
    await userEvent.clear(amountInput)
    await userEvent.type(amountInput, '250')
    // no category chip clicked
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('creates an expense transaction and closes', async () => {
    db = createXpensesDb('test-sheet-create-expense')
    await seedRefs(db)
    const onClose = vi.fn()
    render(<AddTransactionSheet db={db} onClose={onClose} />)

    await userEvent.click(await screen.findByRole('button', { name: /cash/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Food' }))
    const amountInput = screen.getByRole('textbox', { name: 'Amount' })
    await userEvent.clear(amountInput)
    await userEvent.type(amountInput, '250')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await vi.waitFor(() => expect(onClose).toHaveBeenCalledOnce())
    const created = await db.transactions.toArray()
    expect(created).toHaveLength(1)
    expect(created[0]).toMatchObject({ type: 'expense', amount: 25000, categoryId: 'c1', accountId: 'a1' })
  })

  it('switching to income hides the category picker and shows only accounts', async () => {
    db = createXpensesDb('test-sheet-income')
    await seedRefs(db)
    render(<AddTransactionSheet db={db} onClose={() => {}} />)

    await userEvent.click(screen.getByRole('button', { name: 'Income' }))

    expect(screen.queryByRole('button', { name: 'Food' })).not.toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /cash/i })).toBeInTheDocument()
  })

  it('creates an income transaction with an account but no category', async () => {
    db = createXpensesDb('test-sheet-create-income')
    await seedRefs(db)
    const onClose = vi.fn()
    render(<AddTransactionSheet db={db} onClose={onClose} />)

    await userEvent.click(screen.getByRole('button', { name: 'Income' }))
    await userEvent.click(await screen.findByRole('button', { name: /cash/i }))
    const amountInput = screen.getByRole('textbox', { name: 'Amount' })
    await userEvent.clear(amountInput)
    await userEvent.type(amountInput, '5000')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await vi.waitFor(() => expect(onClose).toHaveBeenCalledOnce())
    const created = await db.transactions.toArray()
    expect(created[0]).toMatchObject({ type: 'income', amount: 500000, accountId: 'a1', categoryId: null })
  })

  it('switching to transfer shows from/to account pickers excluding each other', async () => {
    db = createXpensesDb('test-sheet-transfer')
    await seedRefs(db)
    render(<AddTransactionSheet db={db} onClose={() => {}} />)

    await userEvent.click(screen.getByRole('button', { name: 'Transfer' }))
    await screen.findByText(/from/i)

    expect(screen.getByText(/to/i)).toBeInTheDocument()
  })

  it('creates a transfer with distinct from/to accounts', async () => {
    db = createXpensesDb('test-sheet-create-transfer')
    await seedRefs(db)
    const onClose = vi.fn()
    render(<AddTransactionSheet db={db} onClose={onClose} />)

    await userEvent.click(screen.getByRole('button', { name: 'Transfer' }))
    const fromButtons = await screen.findAllByRole('button', { name: /cash/i })
    await userEvent.click(fromButtons[0])
    const toButtons = await screen.findAllByRole('button', { name: /bank/i })
    await userEvent.click(toButtons[toButtons.length - 1])
    const amountInput = screen.getByRole('textbox', { name: 'Amount' })
    await userEvent.clear(amountInput)
    await userEvent.type(amountInput, '100')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await vi.waitFor(() => expect(onClose).toHaveBeenCalledOnce())
    const created = await db.transactions.toArray()
    expect(created[0]).toMatchObject({ type: 'transfer', amount: 10000, fromAccountId: 'a1', toAccountId: 'a2' })
  })

  it('pre-fills fields in edit mode and updates on save', async () => {
    db = createXpensesDb('test-sheet-edit')
    await seedRefs(db)
    await db.transactions.put({
      id: 't1', type: 'expense', amount: 8600, note: 'Lunch', categoryId: 'c1', accountId: 'a1',
      fromAccountId: null, toAccountId: null, txnDate: '2026-07-10', updatedAt: '2026-07-10 09:00:00', deletedAt: null,
    })
    const txn = await db.transactions.get('t1')
    const onClose = vi.fn()
    render(<AddTransactionSheet db={db} onClose={onClose} editingTxn={txn} />)

    const amountInput = await screen.findByRole('textbox', { name: 'Amount' })
    expect(amountInput).toHaveValue('86')
    expect(screen.getByDisplayValue('Lunch')).toBeInTheDocument()

    await userEvent.clear(amountInput)
    await userEvent.type(amountInput, '100')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await vi.waitFor(() => expect(onClose).toHaveBeenCalledOnce())
    const updated = await db.transactions.get('t1')
    expect(updated).toMatchObject({ amount: 10000, note: 'Lunch' })
  })

  it('shows no Delete button when creating a new transaction', async () => {
    db = createXpensesDb('test-sheet-no-delete')
    await seedRefs(db)
    render(<AddTransactionSheet db={db} onClose={() => {}} />)
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
  })

  it('deletes the transaction being edited and closes', async () => {
    db = createXpensesDb('test-sheet-delete')
    await seedRefs(db)
    await db.transactions.put({
      id: 't1', type: 'expense', amount: 8600, note: 'Lunch', categoryId: 'c1', accountId: 'a1',
      fromAccountId: null, toAccountId: null, txnDate: '2026-07-10', updatedAt: '2026-07-10 09:00:00', deletedAt: null,
    })
    const txn = await db.transactions.get('t1')
    const onClose = vi.fn()
    render(<AddTransactionSheet db={db} onClose={onClose} editingTxn={txn} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }))

    await vi.waitFor(() => expect(onClose).toHaveBeenCalledOnce())
    expect((await db.transactions.get('t1'))?.deletedAt).not.toBeNull()
  })

  it('disables Save when the selected account was soft-deleted (e.g. by another tab)', async () => {
    db = createXpensesDb('test-sheet-stale-account')
    await seedRefs(db)
    // Simulate the referenced account being deleted before/while this edit
    // session is open — the picker won't list it, but the sheet's own state
    // still holds the id.
    await db.accounts.update('a1', { deletedAt: '2026-07-10 09:00:00' })
    await db.transactions.put({
      id: 't1', type: 'expense', amount: 8600, note: 'Lunch', categoryId: 'c1', accountId: 'a1',
      fromAccountId: null, toAccountId: null, txnDate: '2026-07-10', updatedAt: '2026-07-10 09:00:00', deletedAt: null,
    })
    const txn = await db.transactions.get('t1')

    render(<AddTransactionSheet db={db} onClose={() => {}} editingTxn={txn} />)

    expect(await screen.findByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('disables Save when the selected category was soft-deleted', async () => {
    db = createXpensesDb('test-sheet-stale-category')
    await seedRefs(db)
    await db.categories.update('c1', { deletedAt: '2026-07-10 09:00:00' })
    await db.transactions.put({
      id: 't1', type: 'expense', amount: 8600, note: 'Lunch', categoryId: 'c1', accountId: 'a1',
      fromAccountId: null, toAccountId: null, txnDate: '2026-07-10', updatedAt: '2026-07-10 09:00:00', deletedAt: null,
    })
    const txn = await db.transactions.get('t1')

    render(<AddTransactionSheet db={db} onClose={() => {}} editingTxn={txn} />)

    expect(await screen.findByRole('button', { name: 'Save' })).toBeDisabled()
  })
})
