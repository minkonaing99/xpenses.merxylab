import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TxnRow } from './TxnRow'

describe('TxnRow', () => {
  it('renders note, category/date caption, and a signed formatted amount', () => {
    render(
      <TxnRow
        icon="shopping-cart"
        note="Big C groceries"
        caption="Groceries · Jul 10"
        amountSatang={-86000}
        type="expense"
      />,
    )
    expect(screen.getByText('Big C groceries')).toBeInTheDocument()
    expect(screen.getByText('Groceries · Jul 10')).toBeInTheDocument()
    expect(screen.getByText('-฿860')).toBeInTheDocument()
  })

  it('renders income amounts with a plus sign and success color class', () => {
    render(
      <TxnRow
        icon="money-wavy"
        note="Payday"
        caption="Salary · Jul 8"
        amountSatang={4500000}
        type="income"
      />,
    )
    const amount = screen.getByText('+฿45,000')
    expect(amount).toHaveClass('txn-row__amount--income')
  })
})
