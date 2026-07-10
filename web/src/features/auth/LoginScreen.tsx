import { useState, type FormEvent } from 'react'
import { Panel } from '../../ui/Panel'
import { Button } from '../../ui/Button'
import { Banner } from '../../ui/Banner'
import { ApiClientError } from '../../lib/fetchClient'
import { login } from './api'
import './LoginScreen.css'

interface LoginScreenProps {
  onSuccess: () => void
}

export function LoginScreen({ onSuccess }: LoginScreenProps) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(password)
      onSuccess()
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Something went wrong. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="screen">
      <div className="screen__header">
        <div className="text-screen-title">xpenses</div>
      </div>
      <div className="screen__body">
        <Panel>
          <form className="login-form" onSubmit={handleSubmit}>
            {error && <Banner tone="error" message={error} />}
            <div className="login-form__field">
              <label htmlFor="password" className="text-caption-strong">
                Password
              </label>
              <input
                id="password"
                className="login-form__input"
                type="password"
                autoComplete="current-password"
                autoFocus
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            <Button type="submit" disabled={submitting || password.trim().length === 0}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </Panel>
      </div>
    </div>
  )
}
