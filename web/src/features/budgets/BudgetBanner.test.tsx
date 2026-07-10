import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { BudgetBanner } from './BudgetBanner'

describe('BudgetBanner', () => {
  it('shows how much a category is over budget', () => {
    render(<BudgetBanner categoryName="Groceries" spent={642000} limitAmount={600000} onDismiss={vi.fn()} />)
    expect(screen.getByText('Groceries is ฿420 over budget this month')).toBeInTheDocument()
  })

  it('calls onDismiss when dismissed', async () => {
    const onDismiss = vi.fn()
    render(<BudgetBanner categoryName="Groceries" spent={642000} limitAmount={600000} onDismiss={onDismiss} />)
    await userEvent.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(onDismiss).toHaveBeenCalledOnce()
  })
})
