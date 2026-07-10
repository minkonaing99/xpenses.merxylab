import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ReportsScreen } from './ReportsScreen'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status })
}

describe('ReportsScreen', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders category spend and account summary from the live API', async () => {
    vi.mocked(fetch).mockImplementation((url: unknown) => {
      const u = String(url)
      if (u.includes('category-spend')) {
        return Promise.resolve(jsonResponse({ ok: true, data: [{ categoryId: 'c1', name: 'Rent', total: 1250000 }] }))
      }
      return Promise.resolve(
        jsonResponse({
          ok: true,
          data: { accounts: [{ id: 'a1', name: 'Cash', type: 'cash', balance: 64200 }], monthIncome: 500000, monthExpense: 320000, monthNet: 180000 },
        }),
      )
    })

    render(<ReportsScreen />)

    expect(await screen.findByText('Rent')).toBeInTheDocument()
    expect(await screen.findByText('Cash')).toBeInTheDocument()
  })

  it('shows an error banner when the reports API is unreachable', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'))

    render(<ReportsScreen />)

    expect(await screen.findByText(/couldn.t load reports/i)).toBeInTheDocument()
  })
})
