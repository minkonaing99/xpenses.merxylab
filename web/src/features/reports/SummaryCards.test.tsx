import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SummaryCards } from './SummaryCards'

describe('SummaryCards', () => {
  it('shows account balances and the monthly net', () => {
    render(
      <SummaryCards
        accounts={[{ id: 'a1', name: 'Cash', type: 'cash', balance: 64200 }]}
        monthIncome={500000}
        monthExpense={320000}
        monthNet={180000}
      />,
    )

    expect(screen.getByText('Cash')).toBeInTheDocument()
    expect(screen.getByText('฿642')).toBeInTheDocument()
    expect(screen.getByText('+฿1,800')).toBeInTheDocument()
  })

  it('shows a negative net with a minus sign', () => {
    render(<SummaryCards accounts={[]} monthIncome={100000} monthExpense={320000} monthNet={-220000} />)
    expect(screen.getByText('-฿2,200')).toBeInTheDocument()
  })
})
