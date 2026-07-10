import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { login, logout, me } from './api'

describe('auth api', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('login posts the password to /api/auth/login', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ ok: true, data: {} }), { status: 200 }))

    await login('changeme123')

    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe('/api/auth/login')
    expect(init?.body).toBe(JSON.stringify({ password: 'changeme123' }))
  })

  it('me GETs /api/auth/me and returns the authenticated flag', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: { authenticated: true } }), { status: 200 }),
    )

    await expect(me()).resolves.toEqual({ authenticated: true })
  })

  it('logout posts to /api/auth/logout and clears the api-get-cache', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ ok: true, data: {} }), { status: 200 }))
    const cachesDelete = vi.fn().mockResolvedValue(true)
    vi.stubGlobal('caches', { delete: cachesDelete })

    await logout()

    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/api/auth/logout')
    expect(cachesDelete).toHaveBeenCalledWith('api-get-cache')
  })

  it('logout still resolves when the Cache Storage API is unavailable', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ ok: true, data: {} }), { status: 200 }))

    await expect(logout()).resolves.toBeUndefined()
  })
})
