import { useMemo, useState } from 'react'
import { MagnifyingGlass, Plus } from '@phosphor-icons/react'
import { Panel } from '../../ui/Panel'
import { TxnRow } from '../../ui/TxnRow'
import { EmptyState } from '../../ui/EmptyState'
import { formatTHB } from '../../lib/money'
import { useTransactions, useCategories, useAccounts } from '../../offline/hooks'
import { calculateNet, toTxnRowProps } from './txnMapping'
import { AddTransactionSheet } from './AddTransactionSheet'
import type { XpensesDb, CachedTransaction } from '../../offline/db'
import './TransactionsScreen.css'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

interface TransactionsScreenProps {
  db: XpensesDb
}

export function TransactionsScreen({ db }: TransactionsScreenProps) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const month = today.slice(0, 7)
  const transactions = useTransactions(db, { month })
  const categories = useCategories(db)
  const accounts = useAccounts(db)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingTxn, setEditingTxn] = useState<CachedTransaction | undefined>(undefined)

  const netThisMonthSatang = transactions ? calculateNet(transactions) : 0
  const categoriesById = useMemo(() => new Map((categories ?? []).map((c) => [c.id, c])), [categories])
  const accountsById = useMemo(() => new Map((accounts ?? []).map((a) => [a.id, a])), [accounts])

  function openAdd() {
    setEditingTxn(undefined)
    setSheetOpen(true)
  }

  function openEdit(txn: CachedTransaction) {
    setEditingTxn(txn)
    setSheetOpen(true)
  }

  return (
    <div className="screen">
      <div className="screen__header">
        <div className="screen__title-row">
          <button type="button" className="screen__month">
            {MONTHS[Number(month.slice(5, 7)) - 1]}
          </button>
          <button type="button" className="screen__icon-btn" aria-label="Search transactions">
            <MagnifyingGlass size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="text-caption">Net this month</div>
        <div
          className="text-amount tabular screen__net"
          style={{ color: netThisMonthSatang >= 0 ? 'var(--color-success)' : 'var(--color-error)' }}
        >
          {netThisMonthSatang >= 0 ? '+' : ''}
          {formatTHB(netThisMonthSatang)}
        </div>
      </div>

      {transactions !== undefined && transactions.length === 0 ? (
        <div className="screen__body">
          <EmptyState
            title="No transactions yet"
            description="Tap the + button to log your first expense or income for this month."
          />
        </div>
      ) : (
        <div className="screen__body">
          <Panel>
            <div className="screen__section-header text-section-header">Recent</div>
            {transactions?.map((t) => {
              const rowProps = toTxnRowProps(t, { categoriesById, accountsById, today })
              return (
                <button
                  key={t.id}
                  type="button"
                  className="transactions__row-btn"
                  onClick={() => openEdit(t)}
                  aria-label={`Edit ${rowProps.note}`}
                >
                  <TxnRow {...rowProps} />
                </button>
              )
            })}
          </Panel>
        </div>
      )}

      <button type="button" className="screen__fab" aria-label="Add transaction" onClick={openAdd}>
        <Plus size={24} weight="bold" aria-hidden="true" />
      </button>

      {sheetOpen && (
        <AddTransactionSheet db={db} onClose={() => setSheetOpen(false)} editingTxn={editingTxn} />
      )}
    </div>
  )
}
