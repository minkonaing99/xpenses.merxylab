import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CategoryChart } from './CategoryChart'

describe('CategoryChart', () => {
  it('shows each category and the total spent', () => {
    render(
      <CategoryChart
        categorySpend={[
          { categoryId: 'c1', name: 'Rent', total: 1250000 },
          { categoryId: 'c2', name: 'Groceries', total: 642000 },
        ]}
      />,
    )

    expect(screen.getByText('Rent')).toBeInTheDocument()
    expect(screen.getByText('฿12,500')).toBeInTheDocument()
    expect(screen.getByText(/Total ฿18,920/)).toBeInTheDocument()
  })

  it('shows an empty state when there is no spend this month', () => {
    render(<CategoryChart categorySpend={[]} />)
    expect(screen.getByText(/no spending yet/i)).toBeInTheDocument()
  })
})
