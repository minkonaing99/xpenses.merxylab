import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppRoutes } from './App'
import * as authApi from '../features/auth/api'
import * as offlineSync from '../offline/sync'
import { ApiClientError } from '../lib/fetchClient'

vi.mock('../features/auth/api')
vi.mock('../offline/sync')

describe('AppRoutes', () => {
  beforeEach(() => {
    vi.mocked(authApi.me).mockResolvedValue({ authenticated: true })
    vi.mocked(offlineSync.pull).mockResolvedValue(undefined)
    vi.mocked(offlineSync.push).mockResolvedValue([])
  })

  it('renders the Transactions screen at the root route once authenticated', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>,
    )
    // The real offline cache (singleton db) starts empty in this test —
    // pull()/push() are mocked no-ops — so the screen's empty state is the
    // deterministic thing to assert on here. Data-driven rendering is
    // covered by TransactionsScreen's own test file with an isolated db.
    expect(await screen.findByText(/no transactions yet/i)).toBeInTheDocument()
  })

  it('navigates to Budgets when the Budgets tab is clicked', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>,
    )
    await userEvent.click(await screen.findByRole('link', { name: /budgets/i }))
    // Real singleton db is empty in this test (same reasoning as the
    // Transactions test above) — the empty state is the deterministic thing
    // to assert on; data-driven rendering is covered by BudgetsScreen's own
    // test file with an isolated db + mocked budgets API.
    expect(await screen.findByText(/no budgets yet/i)).toBeInTheDocument()
  })

  it('redirects to the login screen on a real 401', async () => {
    vi.mocked(authApi.me).mockRejectedValue(new ApiClientError(401, 'UNAUTHORIZED', 'no session'))
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>,
    )
    expect(await screen.findByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('shows an error banner instead of redirecting on a network failure', async () => {
    vi.mocked(authApi.me).mockRejectedValue(new TypeError('Failed to fetch'))
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>,
    )
    expect(await screen.findByText(/couldn.t reach the server/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument()
  })
})
