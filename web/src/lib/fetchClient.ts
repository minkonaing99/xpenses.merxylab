interface ApiEnvelope<T> {
  ok: boolean
  data?: T
  error?: { code: string; message: string }
}

export class ApiClientError extends Error {
  code: string
  status: number

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiClientError'
    this.status = status
    this.code = code
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init.headers },
  })

  const body: ApiEnvelope<T> = await res.json()

  if (!res.ok || !body.ok) {
    const error = body.error ?? { code: 'UNKNOWN', message: 'request failed' }
    throw new ApiClientError(res.status, error.code, error.message)
  }

  return body.data as T
}
