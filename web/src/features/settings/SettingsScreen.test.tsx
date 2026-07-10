import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { createXpensesDb, type XpensesDb } from '../../offline/db'
import { SettingsScreen } from './SettingsScreen'

function renderSettings(db: XpensesDb) {
  return render(
    <MemoryRouter>
      <SettingsScreen db={db} />
    </MemoryRouter>,
  )
}

describe('SettingsScreen', () => {
  let db: XpensesDb

  afterEach(async () => {
    await db?.delete()
  })

  it('links to Accounts, Categories, and Recurring', () => {
    db = createXpensesDb('test-settings-links')
    renderSettings(db)

    expect(screen.getByRole('link', { name: 'Accounts' })).toHaveAttribute('href', '/accounts')
    expect(screen.getByRole('link', { name: 'Categories' })).toHaveAttribute('href', '/categories')
    expect(screen.getByRole('link', { name: 'Recurring' })).toHaveAttribute('href', '/recurring')
  })

  it('shows no sync banner when the outbox is empty', async () => {
    db = createXpensesDb('test-settings-sync-empty')
    renderSettings(db)

    expect(await screen.findByRole('link', { name: 'Accounts' })).toBeInTheDocument()
    expect(screen.queryByText(/couldn.t sync/i)).not.toBeInTheDocument()
  })

  it('warns when there are failed outbox ops', async () => {
    db = createXpensesDb('test-settings-sync-failed')
    await db.outbox.add({ entity: 'transactions', action: 'update', payload: { id: 't1' }, createdAt: 'x', status: 'failed' })
    renderSettings(db)

    expect(await screen.findByText(/1 change couldn.t sync/i)).toBeInTheDocument()
  })

  it('pluralizes the failed-change count', async () => {
    db = createXpensesDb('test-settings-sync-failed-plural')
    await db.outbox.bulkAdd([
      { entity: 'transactions', action: 'update', payload: { id: 't1' }, createdAt: 'x', status: 'failed' },
      { entity: 'accounts', action: 'create', payload: { id: 'a1' }, createdAt: 'x', status: 'failed' },
    ])
    renderSettings(db)

    expect(await screen.findByText(/2 changes couldn.t sync/i)).toBeInTheDocument()
  })
})
