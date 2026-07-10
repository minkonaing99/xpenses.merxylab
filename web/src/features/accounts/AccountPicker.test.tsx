import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createXpensesDb, type XpensesDb } from '../../offline/db'
import { AccountPicker } from './AccountPicker'

describe('AccountPicker', () => {
  let db: XpensesDb

  afterEach(async () => {
    await db?.delete()
  })

  it('renders a chip per non-deleted account, sorted by sortOrder', async () => {
    db = createXpensesDb('test-accountpicker-list')
    await db.accounts.bulkPut([
      { id: 'a2', name: 'Bank', type: 'bank', startingBalance: 0, balance: 0, sortOrder: 1, updatedAt: 'x', deletedAt: null },
      { id: 'a1', name: 'Cash', type: 'cash', startingBalance: 0, balance: 0, sortOrder: 0, updatedAt: 'x', deletedAt: null },
      { id: 'a3', name: 'Gone', type: 'cash', startingBalance: 0, balance: 0, sortOrder: 2, updatedAt: 'x', deletedAt: 'x' },
    ])

    render(<AccountPicker db={db} value={null} onChange={vi.fn()} />)

    expect(await screen.findByRole('button', { name: /cash/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /bank/i })).toBeInTheDocument()
    expect(screen.queryByText('Gone')).not.toBeInTheDocument()
  })

  it('marks the chip matching value as selected', async () => {
    db = createXpensesDb('test-accountpicker-selected')
    await db.accounts.put({ id: 'a1', name: 'Cash', type: 'cash', startingBalance: 0, balance: 0, sortOrder: 0, updatedAt: 'x', deletedAt: null })

    render(<AccountPicker db={db} value="a1" onChange={vi.fn()} />)

    expect(await screen.findByRole('button', { name: /cash/i })).toHaveAttribute('aria-pressed', 'true')
  })

  it('calls onChange with the account id when a chip is clicked', async () => {
    db = createXpensesDb('test-accountpicker-click')
    await db.accounts.put({ id: 'a1', name: 'Cash', type: 'cash', startingBalance: 0, balance: 0, sortOrder: 0, updatedAt: 'x', deletedAt: null })
    const onChange = vi.fn()

    render(<AccountPicker db={db} value={null} onChange={onChange} />)
    await userEvent.click(await screen.findByRole('button', { name: /cash/i }))

    expect(onChange).toHaveBeenCalledWith('a1')
  })

  it('excludes an account id via the exclude prop (for transfer to != from)', async () => {
    db = createXpensesDb('test-accountpicker-exclude')
    await db.accounts.bulkPut([
      { id: 'a1', name: 'Cash', type: 'cash', startingBalance: 0, balance: 0, sortOrder: 0, updatedAt: 'x', deletedAt: null },
      { id: 'a2', name: 'Bank', type: 'bank', startingBalance: 0, balance: 0, sortOrder: 1, updatedAt: 'x', deletedAt: null },
    ])

    render(<AccountPicker db={db} value={null} onChange={vi.fn()} exclude="a1" />)

    await screen.findByRole('button', { name: /bank/i })
    expect(screen.queryByRole('button', { name: /cash/i })).not.toBeInTheDocument()
  })
})
