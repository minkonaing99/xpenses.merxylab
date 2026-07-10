import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AmountInput } from './AmountInput'

describe('AmountInput', () => {
  it('displays the satang value formatted as baht', () => {
    render(<AmountInput valueSatang={86000} onChange={() => {}} />)
    expect(screen.getByRole('textbox')).toHaveValue('860')
  })

  it('converts typed baht input to satang on change', async () => {
    const onChange = vi.fn()
    render(<AmountInput valueSatang={0} onChange={onChange} />)
    const input = screen.getByRole('textbox')
    await userEvent.type(input, '5')
    expect(onChange).toHaveBeenLastCalledWith(500)
  })

  it('defaults to the borderless hero style (full-screen amount entry, e.g. AddTransactionSheet)', () => {
    render(<AmountInput valueSatang={0} onChange={() => {}} />)
    expect(screen.getByRole('textbox').parentElement).toHaveClass('amount-input--hero')
  })

  it('renders a bordered field style for inline forms (e.g. AccountsScreen, BudgetsScreen)', () => {
    render(<AmountInput valueSatang={0} onChange={() => {}} variant="field" />)
    expect(screen.getByRole('textbox').parentElement).toHaveClass('amount-input--field')
  })
})
