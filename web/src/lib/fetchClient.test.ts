import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiFetch, ApiClientError } from './fetchClient'

describe('apiFetch', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('calls the given path under /api with credentials included', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: { authenticated: true } }), { status: 200 }),
    )

    await apiFetch('/auth/me')

    expect(fetch).toHaveBeenCalledWith(
      '/api/auth/me',
      expect.objectContaining({ credentials: 'include' }),
    )
  })

  it('returns the unwrapped data on a successful envelope', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: { authenticated: true } }), { status: 200 }),
    )

    const data = await apiFetch<{ authenticated: boolean }>('/auth/me')

    expect(data).toEqual({ authenticated: true })
  })

  it('sends a JSON content-type header and stringified body for POST', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ ok: true, data: {} }), { status: 200 }))

    await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ password: 'x' }) })

    const [, init] = vi.mocked(fetch).mock.calls[0]
    expect(init?.method).toBe('POST')
    expect(init?.body).toBe(JSON.stringify({ password: 'x' }))
    expect((init?.headers as Record<string, string>)['Content-Type']).toBe('application/json')
  })

  it('throws ApiClientError with the server error code/message on a failed envelope', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ ok: false, error: { code: 'UNAUTHORIZED', message: 'invalid password' } }),
        { status: 401 },
      ),
    )

    await expect(apiFetch('/auth/login')).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'invalid password',
      status: 401,
    })
  })

  it('throws an ApiClientError instance on failure', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ ok: false, error: { code: 'NOT_FOUND', message: 'nope' } }), {
        status: 404,
      }),
    )

    await expect(apiFetch('/x')).rejects.toBeInstanceOf(ApiClientError)
  })
})
