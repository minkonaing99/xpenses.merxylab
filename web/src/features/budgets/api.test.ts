import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getBudgets } from './api'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status })
}

describe('budgets api', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('GETs /api/budgets with the month query and returns the unwrapped array', async () => {
    const budgets = [{ id: 'b1', categoryId: 'c1', limitAmount: 60000, spent: 64200, over: true, updatedAt: 'x', deletedAt: null }]
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ ok: true, data: budgets }))

    const result = await getBudgets('2026-07')

    expect(fetch).toHaveBeenCalledWith('/api/budgets?month=2026-07', expect.anything())
    expect(result).toEqual(budgets)
  })
})
