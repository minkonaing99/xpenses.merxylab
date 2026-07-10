import { useEffect, useRef, useState } from 'react'
import { AmountInput } from '../../ui/AmountInput'
import { AccountPicker } from '../accounts/AccountPicker'
import { CategoryPicker } from '../categories/CategoryPicker'
import { createTransaction, updateTransaction, deleteTransaction } from '../../offline/mutations'
import { useAccounts, useCategories } from '../../offline/hooks'
import { validateTransactionFields } from './validateTransactionFields'
import type { XpensesDb, CachedTransaction } from '../../offline/db'
import type { TxnType } from '../../ui/TxnRow'
import './AddTransactionSheet.css'

const TYPES: { value: TxnType; label: string }[] = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
  { value: 'transfer', label: 'Transfer' },
]

interface AddTransactionSheetProps {
  db: XpensesDb
  onClose: () => void
  editingTxn?: CachedTransaction
}

export function AddTransactionSheet({ db, onClose, editingTxn }: AddTransactionSheetProps) {
  const [type, setType] = useState<TxnType>((editingTxn?.type as TxnType) ?? 'expense')
  const [accountId, setAccountId] = useState<string | null>(editingTxn?.accountId ?? null)
  const [categoryId, setCategoryId] = useState<string | null>(editingTxn?.categoryId ?? null)
  const [fromAccountId, setFromAccountId] = useState<string | null>(editingTxn?.fromAccountId ?? null)
  const [toAccountId, setToAccountId] = useState<string | null>(editingTxn?.toAccountId ?? null)
  const [amountSatang, setAmountSatang] = useState(editingTxn?.amount ?? 0)
  const [note, setNote] = useState(editingTxn?.note ?? '')
  const [txnDate] = useState(editingTxn?.txnDate ?? new Date().toISOString().slice(0, 10))

  // Live-checked against the current cache so a selection that was
  // soft-deleted by another tab/device while this sheet was open (or was
  // already gone when an existing transaction was opened for edit) can't be
  // silently resubmitted — validateTransactionFields only checks
  // presence/absence of the ids, not whether they still resolve to a row.
  const liveAccounts = useAccounts(db)
  const liveCategories = useCategories(db)
  const accountIds = new Set(liveAccounts?.map((a) => a.id))
  const categoryIds = new Set(liveCategories?.map((c) => c.id))
  const staleSelection =
    (accountId != null && !accountIds.has(accountId)) ||
    (categoryId != null && !categoryIds.has(categoryId)) ||
    (fromAccountId != null && !accountIds.has(fromAccountId)) ||
    (toAccountId != null && !accountIds.has(toAccountId))

  const fieldError = validateTransactionFields({
    type,
    categoryId: type === 'expense' ? categoryId : null,
    accountId: type === 'expense' || type === 'income' ? accountId : null,
    fromAccountId: type === 'transfer' ? fromAccountId : null,
    toAccountId: type === 'transfer' ? toAccountId : null,
  })
  const isValid = amountSatang > 0 && fieldError === null && !staleSelection

  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    dialogRef.current?.focus()
  }, [])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  async function handleSave() {
    if (!isValid) return
    const input = {
      type,
      amount: amountSatang,
      note: note || null,
      categoryId: type === 'expense' ? categoryId : null,
      accountId: type === 'expense' || type === 'income' ? accountId : null,
      fromAccountId: type === 'transfer' ? fromAccountId : null,
      toAccountId: type === 'transfer' ? toAccountId : null,
      txnDate,
    }
    if (editingTxn) {
      await updateTransaction(db, editingTxn.id, input)
    } else {
      await createTransaction(db, input)
    }
    onClose()
  }

  async function handleDelete() {
    if (!editingTxn) return
    await deleteTransaction(db, editingTxn.id)
    onClose()
  }

  return (
    <div className="sheet-backdrop">
      <div className="sheet" role="dialog" aria-label="Transaction" tabIndex={-1} ref={dialogRef}>
        <div className="sheet__handle" />
        <div className="sheet__header">
          <button type="button" className="text-body" onClick={onClose}>
            Cancel
          </button>
          <span className="text-body-strong">{editingTxn ? 'Edit Transaction' : 'New Transaction'}</span>
          <button
            type="button"
            className="text-body-strong sheet__save"
            onClick={handleSave}
            disabled={!isValid}
          >
            Save
          </button>
        </div>

        <div className="sheet__type-toggle">
          {TYPES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              className={`sheet__type-btn${type === value ? ' sheet__type-btn--active' : ''}`}
              aria-pressed={type === value}
              onClick={() => setType(value)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="sheet__amount">
          <div className="text-caption">Amount</div>
          <AmountInput valueSatang={amountSatang} onChange={setAmountSatang} />
        </div>

        {type === 'expense' && (
          <>
            <div className="sheet__field">
              <div className="text-caption-strong">Account</div>
              <AccountPicker db={db} value={accountId} onChange={setAccountId} />
            </div>
            <div className="sheet__field">
              <div className="text-caption-strong">Category</div>
              <CategoryPicker db={db} value={categoryId} onChange={setCategoryId} />
            </div>
          </>
        )}

        {type === 'income' && (
          <div className="sheet__field">
            <div className="text-caption-strong">Account</div>
            <AccountPicker db={db} value={accountId} onChange={setAccountId} />
          </div>
        )}

        {type === 'transfer' && (
          <>
            <div className="sheet__field">
              <div className="text-caption-strong">From</div>
              <AccountPicker db={db} value={fromAccountId} onChange={setFromAccountId} exclude={toAccountId ?? undefined} />
            </div>
            <div className="sheet__field">
              <div className="text-caption-strong">To</div>
              <AccountPicker db={db} value={toAccountId} onChange={setToAccountId} exclude={fromAccountId ?? undefined} />
            </div>
          </>
        )}

        <div className="sheet__field">
          <label className="text-caption-strong" htmlFor="txn-note">
            Note
          </label>
          <input
            id="txn-note"
            type="text"
            className="sheet__note-input text-body"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        {editingTxn && (
          <div className="sheet__field">
            <button type="button" className="sheet__delete text-body-strong" onClick={handleDelete}>
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
