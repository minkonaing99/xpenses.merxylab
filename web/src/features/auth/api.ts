import { apiFetch } from '../../lib/fetchClient'

export function login(password: string): Promise<void> {
  return apiFetch<Record<string, never>>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  }).then(() => undefined)
}

export async function logout(): Promise<void> {
  await apiFetch<Record<string, never>>('/auth/logout', { method: 'POST' })
  if (typeof caches !== 'undefined') {
    await caches.delete('api-get-cache')
  }
}

export function me(): Promise<{ authenticated: boolean }> {
  return apiFetch('/auth/me')
}
