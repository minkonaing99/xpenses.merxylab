import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getCategorySpend, getSummary } from './api'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status })
}

describe('reports api', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('GETs /api/reports/category-spend with the month query', async () => {
    const rows = [{ categoryId: 'c1', name: 'Food', total: 64200 }]
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ ok: true, data: rows }))

    const result = await getCategorySpend('2026-07')

    expect(fetch).toHaveBeenCalledWith('/api/reports/category-spend?month=2026-07', expect.anything())
    expect(result).toEqual(rows)
  })

  it('GETs /api/reports/summary with the month query', async () => {
    const summary = { accounts: [], monthIncome: 500000, monthExpense: 320000, monthNet: 180000 }
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ ok: true, data: summary }))

    const result = await getSummary('2026-07')

    expect(fetch).toHaveBeenCalledWith('/api/reports/summary?month=2026-07', expect.anything())
    expect(result).toEqual(summary)
  })
})
