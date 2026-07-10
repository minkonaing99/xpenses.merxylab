import { Bank, Wallet } from '@phosphor-icons/react'
import { useAccounts } from '../../offline/hooks'
import type { XpensesDb } from '../../offline/db'
import './AccountPicker.css'

const ICON_BY_TYPE: Record<string, typeof Bank> = { bank: Bank, cash: Wallet, other: Wallet }

interface AccountPickerProps {
  db: XpensesDb
  value: string | null
  onChange: (accountId: string) => void
  exclude?: string
}

export function AccountPicker({ db, value, onChange, exclude }: AccountPickerProps) {
  const accounts = useAccounts(db)
  const visible = accounts?.filter((account) => account.id !== exclude)

  return (
    <div className="chip-row">
      {visible?.map((account) => {
        const Icon = ICON_BY_TYPE[account.type] ?? Wallet
        const selected = value === account.id
        return (
          <button
            key={account.id}
            type="button"
            className={`account-chip${selected ? ' account-chip--selected' : ''}`}
            aria-pressed={selected}
            onClick={() => onChange(account.id)}
          >
            <Icon size={16} weight={selected ? 'fill' : 'regular'} aria-hidden="true" />
            {account.name}
          </button>
        )
      })}
    </div>
  )
}
