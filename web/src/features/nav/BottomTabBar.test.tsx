import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { BottomTabBar } from './BottomTabBar'

describe('BottomTabBar', () => {
  it('renders all four tabs', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <BottomTabBar />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: /transactions/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /reports/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /budgets/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /settings/i })).toBeInTheDocument()
  })

  it('marks the active tab with aria-current', () => {
    render(
      <MemoryRouter initialEntries={['/budgets']}>
        <BottomTabBar />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: /budgets/i })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: /reports/i })).not.toHaveAttribute('aria-current')
  })
})
