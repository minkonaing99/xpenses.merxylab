import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createXpensesDb, type XpensesDb } from '../../offline/db'
import { CategoriesScreen } from './CategoriesScreen'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status })
}

describe('CategoriesScreen', () => {
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

  it('shows an empty state when there are no categories', async () => {
    db = createXpensesDb('test-categoriesscreen-empty')
    render(<CategoriesScreen db={db} />)

    expect(await screen.findByText(/no categories yet/i)).toBeInTheDocument()
  })

  it('lists existing categories', async () => {
    db = createXpensesDb('test-categoriesscreen-list')
    await db.categories.put({ id: 'c1', name: 'Food', icon: null, sortOrder: 0, updatedAt: 'x', deletedAt: null })
    render(<CategoriesScreen db={db} />)

    expect(await screen.findByText('Food')).toBeInTheDocument()
  })

  it('adds a new category and clears the input', async () => {
    db = createXpensesDb('test-categoriesscreen-add')
    render(<CategoriesScreen db={db} />)

    const input = screen.getByLabelText(/category name/i)
    await userEvent.type(input, 'Groceries')
    await userEvent.click(screen.getByRole('button', { name: /add/i }))

    expect(await screen.findByText('Groceries')).toBeInTheDocument()
    expect(input).toHaveValue('')
  })

  it('does not add a blank category', async () => {
    db = createXpensesDb('test-categoriesscreen-blank')
    render(<CategoriesScreen db={db} />)

    expect(screen.getByRole('button', { name: /add/i })).toBeDisabled()
  })

  it('edits a category by clicking it, then saving', async () => {
    db = createXpensesDb('test-categoriesscreen-edit')
    await db.categories.put({ id: 'c1', name: 'Food', icon: null, sortOrder: 0, updatedAt: 'x', deletedAt: null })
    render(<CategoriesScreen db={db} />)

    await userEvent.click(await screen.findByText('Food'))
    const input = screen.getByLabelText(/category name/i)
    expect(input).toHaveValue('Food')
    await userEvent.clear(input)
    await userEvent.type(input, 'Food & Drink')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))

    expect(await screen.findByText('Food & Drink')).toBeInTheDocument()
    expect(screen.queryByText('Food')).not.toBeInTheDocument()
  })

  it('deletes a category', async () => {
    db = createXpensesDb('test-categoriesscreen-delete')
    await db.categories.put({ id: 'c1', name: 'Food', icon: null, sortOrder: 0, updatedAt: 'x', deletedAt: null })
    render(<CategoriesScreen db={db} />)

    await screen.findByText('Food')
    await userEvent.click(screen.getByRole('button', { name: /delete food/i }))

    expect(await screen.findByText(/no categories yet/i)).toBeInTheDocument()
  })

  it('blocks deleting a category still referenced by transactions and shows why', async () => {
    db = createXpensesDb('test-categoriesscreen-delete-blocked')
    await db.categories.put({ id: 'c1', name: 'Food', icon: null, sortOrder: 0, updatedAt: 'x', deletedAt: null })
    await db.transactions.put({
      id: 't1', type: 'expense', amount: 100, note: null, categoryId: 'c1', accountId: 'a1',
      fromAccountId: null, toAccountId: null, txnDate: '2026-07-01', updatedAt: 'x', deletedAt: null,
    })
    render(<CategoriesScreen db={db} />)

    await screen.findByText('Food')
    await userEvent.click(screen.getByRole('button', { name: /delete food/i }))

    expect(await screen.findByText(/used by 1 transaction/i)).toBeInTheDocument()
    expect((await db.categories.get('c1'))?.deletedAt).toBeNull()
  })
})
