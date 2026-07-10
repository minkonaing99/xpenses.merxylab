import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createXpensesDb, type XpensesDb } from '../../offline/db'
import { CategoryPicker } from './CategoryPicker'

describe('CategoryPicker', () => {
  let db: XpensesDb

  afterEach(async () => {
    await db?.delete()
  })

  it('renders a chip per non-deleted category', async () => {
    db = createXpensesDb('test-categorypicker-list')
    await db.categories.bulkPut([
      { id: 'c1', name: 'Food', icon: null, sortOrder: 0, updatedAt: 'x', deletedAt: null },
      { id: 'c2', name: 'Transport', icon: null, sortOrder: 1, updatedAt: 'x', deletedAt: null },
      { id: 'c3', name: 'Gone', icon: null, sortOrder: 2, updatedAt: 'x', deletedAt: 'x' },
    ])

    render(<CategoryPicker db={db} value={null} onChange={vi.fn()} />)

    await waitFor(() => expect(screen.getByText('Food')).toBeInTheDocument())
    expect(screen.getByText('Transport')).toBeInTheDocument()
    expect(screen.queryByText('Gone')).not.toBeInTheDocument()
  })

  it('marks the chip matching value as selected', async () => {
    db = createXpensesDb('test-categorypicker-selected')
    await db.categories.put({ id: 'c1', name: 'Food', icon: null, sortOrder: 0, updatedAt: 'x', deletedAt: null })

    render(<CategoryPicker db={db} value="c1" onChange={vi.fn()} />)

    expect(await screen.findByRole('button', { name: 'Food' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('calls onChange with the category id when a chip is clicked', async () => {
    db = createXpensesDb('test-categorypicker-click')
    await db.categories.put({ id: 'c1', name: 'Food', icon: null, sortOrder: 0, updatedAt: 'x', deletedAt: null })
    const onChange = vi.fn()

    render(<CategoryPicker db={db} value={null} onChange={onChange} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Food' }))

    expect(onChange).toHaveBeenCalledWith('c1')
  })

  it('excludes category ids listed in excludeIds', async () => {
    db = createXpensesDb('test-categorypicker-excludeids')
    await db.categories.bulkPut([
      { id: 'c1', name: 'Food', icon: null, sortOrder: 0, updatedAt: 'x', deletedAt: null },
      { id: 'c2', name: 'Transport', icon: null, sortOrder: 1, updatedAt: 'x', deletedAt: null },
    ])

    render(<CategoryPicker db={db} value={null} onChange={vi.fn()} excludeIds={new Set(['c1'])} />)

    await screen.findByText('Transport')
    expect(screen.queryByText('Food')).not.toBeInTheDocument()
  })
})
