import type { ChangeEvent } from 'react'
import './AmountInput.css'

interface AmountInputProps {
  valueSatang: number
  onChange: (satang: number) => void
  // 'hero' (default): large borderless centered entry for a full-screen
  // amount field (AddTransactionSheet, RecurringForm). 'field': bordered,
  // left-aligned to match the other bordered text inputs it sits next to in
  // an inline form (AccountsScreen, BudgetsScreen) — without this, reusing
  // the borderless hero style there looked broken/unstyled.
  variant?: 'hero' | 'field'
}

// Displays/accepts whole baht only (matches the bake-off mockup — no decimal
// keypad in v1); satang stays the source of truth per CLAUDE.md money rule.
export function AmountInput({ valueSatang, onChange, variant = 'hero' }: AmountInputProps) {
  const bahtValue = valueSatang === 0 ? '' : String(valueSatang / 100)

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const digits = event.target.value.replace(/[^\d]/g, '')
    const baht = digits === '' ? 0 : Number(digits)
    onChange(baht * 100)
  }

  return (
    <label className={`amount-input amount-input--${variant}`}>
      <span className="amount-input__symbol tabular">฿</span>
      <input
        type="text"
        inputMode="numeric"
        className="amount-input__field tabular"
        value={bahtValue}
        onChange={handleChange}
        aria-label="Amount"
      />
    </label>
  )
}
