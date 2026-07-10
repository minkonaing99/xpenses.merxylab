import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EmptyState } from './EmptyState'

describe('EmptyState', () => {
  it('renders a title and description', () => {
    render(
      <EmptyState
        title="No transactions yet"
        description="Tap the + button to log your first expense or income for this month."
      />,
    )
    expect(screen.getByText('No transactions yet')).toBeInTheDocument()
    expect(
      screen.getByText('Tap the + button to log your first expense or income for this month.'),
    ).toBeInTheDocument()
  })
})
