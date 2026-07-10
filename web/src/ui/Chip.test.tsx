import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Chip } from './Chip'

describe('Chip', () => {
  it('renders its label', () => {
    render(<Chip selected={false} onClick={() => {}}>Groceries</Chip>)
    expect(screen.getByRole('button', { name: 'Groceries' })).toBeInTheDocument()
  })

  it('reflects selected state via aria-pressed', () => {
    render(<Chip selected onClick={() => {}}>Groceries</Chip>)
    expect(screen.getByRole('button', { name: 'Groceries' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('calls onClick when tapped', async () => {
    const onClick = vi.fn()
    render(<Chip selected={false} onClick={onClick}>Dining</Chip>)
    await userEvent.click(screen.getByRole('button', { name: 'Dining' }))
    expect(onClick).toHaveBeenCalledOnce()
  })
})
