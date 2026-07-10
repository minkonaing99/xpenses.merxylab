import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Banner } from './Banner'

describe('Banner', () => {
  it('renders the message', () => {
    render(<Banner tone="warning" message="Groceries is ฿420 over budget this month" />)
    expect(screen.getByText('Groceries is ฿420 over budget this month')).toBeInTheDocument()
  })

  it('calls onDismiss when the dismiss button is clicked', async () => {
    const onDismiss = vi.fn()
    render(<Banner tone="warning" message="Over budget" onDismiss={onDismiss} />)
    await userEvent.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('renders no dismiss button when onDismiss is not provided', () => {
    render(<Banner tone="error" message="Couldn't sync" />)
    expect(screen.queryByRole('button', { name: /dismiss/i })).not.toBeInTheDocument()
  })
})
