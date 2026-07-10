import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LoginScreen } from './LoginScreen'
import { ApiClientError } from '../../lib/fetchClient'
import * as api from './api'

vi.mock('./api')

describe('LoginScreen', () => {
  it('calls onSuccess after a successful login', async () => {
    vi.mocked(api.login).mockResolvedValue(undefined)
    const onSuccess = vi.fn()
    render(<LoginScreen onSuccess={onSuccess} />)

    await userEvent.type(screen.getByLabelText(/password/i), 'changeme123')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    expect(api.login).toHaveBeenCalledWith('changeme123')
    expect(onSuccess).toHaveBeenCalledOnce()
  })

  it('shows the server error message on a failed login and does not call onSuccess', async () => {
    vi.mocked(api.login).mockRejectedValue(new ApiClientError(401, 'UNAUTHORIZED', 'invalid password'))
    const onSuccess = vi.fn()
    render(<LoginScreen onSuccess={onSuccess} />)

    await userEvent.type(screen.getByLabelText(/password/i), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByText('invalid password')).toBeInTheDocument()
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('disables the submit button while the password field is empty', () => {
    render(<LoginScreen onSuccess={vi.fn()} />)
    expect(screen.getByRole('button', { name: /sign in/i })).toBeDisabled()
  })

  it('disables the submit button when the password is whitespace only', async () => {
    render(<LoginScreen onSuccess={vi.fn()} />)
    await userEvent.type(screen.getByLabelText(/password/i), '   ')
    expect(screen.getByRole('button', { name: /sign in/i })).toBeDisabled()
  })
})
