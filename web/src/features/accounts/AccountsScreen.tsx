import { useState, type FormEvent } from 'react'
import { Trash } from '@phosphor-icons/react'
import { Panel } from '../../ui/Panel'
import { Button } from '../../ui/Button'
import { Chip } from '../../ui/Chip'
import { AmountInput } from '../../ui/AmountInput'
import { EmptyState } from '../../ui/EmptyState'
import { Banner } from '../../ui/Banner'
import { formatTHB } from '../../lib/money'
import { useAccounts } from '../../offline/hooks'
import { createAccount, deleteAccount } from '../../offline/mutations'
import { countTransactionsUsingAccount } from '../../offline/references'
import type { XpensesDb } from '../../offline/db'
import './AccountsScreen.css'

const TYPES = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank' },
  { value: 'other', label: 'Other' },
]

interface AccountsScreenProps {
  db: XpensesDb
}

export function AccountsScreen({ db }: AccountsScreenProps) {
  const accounts = useAccounts(db)
  const [name, setName] = useState('')
  const [type, setType] = useState('cash')
  const [startingBalance, setStartingBalance] = useState(0)
  const [blockedDelete, setBlockedDelete] = useState<{ name: string; count: number } | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    await createAccount(db, { name: trimmed, type, startingBalance })
    setName('')
    setType('cash')
    setStartingBalance(0)
  }

  async function handleDelete(id: string, accountName: string) {
    const referenced = await countTransactionsUsingAccount(db, id)
    if (referenced > 0) {
      setBlockedDelete({ name: accountName, count: referenced })
      return
    }
    setBlockedDelete(null)
    await deleteAccount(db, id)
  }

  return (
    <div className="screen">
      <div className="screen__header">
        <div className="text-screen-title">Accounts</div>
      </div>
      <div className="screen__body">
        <Panel>
          <form className="accounts__form" onSubmit={handleSubmit}>
            <label className="accounts__field" htmlFor="account-name">
              <span className="text-caption-strong">Account name</span>
              <input
                id="account-name"
                className="accounts__input text-body"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <div className="accounts__field">
              <span className="text-caption-strong">Type</span>
              <div className="chip-row">
                {TYPES.map((t) => (
                  <Chip key={t.value} selected={type === t.value} onClick={() => setType(t.value)}>
                    {t.label}
                  </Chip>
                ))}
              </div>
            </div>
            <div className="accounts__field">
              <span className="text-caption-strong">Starting balance</span>
              <AmountInput valueSatang={startingBalance} onChange={setStartingBalance} variant="field" />
            </div>
            <Button type="submit" disabled={name.trim().length === 0}>
              Add
            </Button>
          </form>
        </Panel>

        {blockedDelete && (
          <div className="screen__banner">
            <Banner
              tone="warning"
              message={`Can't delete ${blockedDelete.name} — used by ${blockedDelete.count} transaction${blockedDelete.count === 1 ? '' : 's'}.`}
              onDismiss={() => setBlockedDelete(null)}
            />
          </div>
        )}

        {accounts !== undefined && accounts.length === 0 ? (
          <EmptyState title="No accounts yet" description="Add your first account above." />
        ) : (
          <Panel>
            {accounts?.map((account) => (
              <div key={account.id} className="accounts__row">
                <div className="accounts__row-label">
                  <span className="text-body-strong">{account.name}</span>
                  <span className="text-caption">{account.type}</span>
                </div>
                <span className="text-body-strong tabular">{formatTHB(account.balance)}</span>
                <button
                  type="button"
                  className="accounts__delete"
                  aria-label={`Delete ${account.name}`}
                  onClick={() => handleDelete(account.id, account.name)}
                >
                  <Trash size={18} aria-hidden="true" />
                </button>
              </div>
            ))}
          </Panel>
        )}
      </div>
    </div>
  )
}
