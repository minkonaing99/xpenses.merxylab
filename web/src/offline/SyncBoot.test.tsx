import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createXpensesDb, type XpensesDb } from './db'
import { SyncBoot } from './SyncBoot'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status })
}

function emptyPullResponse() {
  return { accounts: [], categories: [], transactions: [], budgets: [], recurringRules: [] }
}

function renderSyncBoot(db: XpensesDb) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route element={<SyncBoot db={db} />}>
          <Route index element={<div>App content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('SyncBoot', () => {
  let db: XpensesDb

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => Promise.resolve(jsonResponse({ ok: true, data: emptyPullResponse() }))),
    )
  })

  afterEach(async () => {
    vi.unstubAllGlobals()
    await db?.delete()
  })

  it('shows a loading skeleton while the initial pull is in flight', () => {
    db = createXpensesDb('test-syncboot-loading')
    renderSyncBoot(db)

    expect(screen.queryByText('App content')).not.toBeInTheDocument()
  })

  it('renders the app once the initial pull resolves', async () => {
    db = createXpensesDb('test-syncboot-ready')
    renderSyncBoot(db)

    expect(await screen.findByText('App content')).toBeInTheDocument()
  })

  it('still renders the app when the initial pull fails (offline-first, never block on network)', async () => {
    db = createXpensesDb('test-syncboot-offline')
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'))
    renderSyncBoot(db)

    expect(await screen.findByText('App content')).toBeInTheDocument()
  })

  it('re-syncs when the browser comes back online', async () => {
    db = createXpensesDb('test-syncboot-online-event')
    renderSyncBoot(db)
    await screen.findByText('App content')
    const callsAfterMount = vi.mocked(fetch).mock.calls.length

    window.dispatchEvent(new Event('online'))

    await vi.waitFor(() => {
      expect(vi.mocked(fetch).mock.calls.length).toBeGreaterThan(callsAfterMount)
    })
  })
})
