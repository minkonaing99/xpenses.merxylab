import { useEffect, useMemo, useRef, useState } from 'react'
import { AmountInput } from '../../ui/AmountInput'
import { Chip } from '../../ui/Chip'
import { AccountPicker } from '../accounts/AccountPicker'
import { CategoryPicker } from '../categories/CategoryPicker'
import { createRecurringRule } from '../../offline/mutations'
import { useAccounts, useCategories } from '../../offline/hooks'
import { validateTransactionFields } from '../transactions/validateTransactionFields'
import type { XpensesDb } from '../../offline/db'
import type { TxnType } from '../../ui/TxnRow'
import '../transactions/AddTransactionSheet.css'
import './RecurringForm.css'

const TYPES: { value: TxnType; label: string }[] = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
  { value: 'transfer', label: 'Transfer' },
]

const INTERVAL_UNITS = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
]

interface RecurringFormProps {
  db: XpensesDb
  onClose: () => void
}

export function RecurringForm({ db, onClose }: RecurringFormProps) {
  const [type, setType] = useState<TxnType>('expense')
  const [accountId, setAccountId] = useState<string | null>(null)
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [fromAccountId, setFromAccountId] = useState<string | null>(null)
  const [toAccountId, setToAccountId] = useState<string | null>(null)
  const [amountSatang, setAmountSatang] = useState(0)
  const [note, setNote] = useState('')
  const [intervalUnit, setIntervalUnit] = useState('month')
  const [intervalCount, setIntervalCount] = useState(1)
  const [nextRunDate, setNextRunDate] = useState('')
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), [])

  // A rule's nextRunDate in the past isn't just "invalid" — the server's
  // catch-up scheduler generates one real transaction per missed scheduled
  // occurrence the next time cron runs, so a backdated date here can flood
  // the account with transactions on the very next tick.
  const isPastDate = nextRunDate !== '' && nextRunDate < todayStr

  // Mirrors AddTransactionSheet's stale-selection guard: a picker only ever
  // lists live rows, but the id in state can go stale if another tab
  // deletes the selected account/category while this sheet is open.
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
  const isValid =
    amountSatang > 0 &&
    fieldError === null &&
    nextRunDate !== '' &&
    !isPastDate &&
    intervalCount >= 1 &&
    !staleSelection

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
    await createRecurringRule(db, {
      type,
      amount: amountSatang,
      note: note || null,
      categoryId: type === 'expense' ? categoryId : null,
      accountId: type === 'expense' || type === 'income' ? accountId : null,
      fromAccountId: type === 'transfer' ? fromAccountId : null,
      toAccountId: type === 'transfer' ? toAccountId : null,
      intervalUnit,
      intervalCount,
      nextRunDate,
    })
    onClose()
  }

  return (
    <div className="sheet-backdrop">
      <div className="sheet" role="dialog" aria-label="Recurring Rule" tabIndex={-1} ref={dialogRef}>
        <div className="sheet__handle" />
        <div className="sheet__header">
          <button type="button" className="text-body" onClick={onClose}>
            Cancel
          </button>
          <span className="text-body-strong">New Recurring</span>
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
          <div className="text-caption-strong">Repeats every</div>
          <div className="chip-row">
            <input
              type="number"
              min={1}
              step={1}
              className="sheet__note-input text-body recurring-form__interval-count"
              value={intervalCount}
              onChange={(e) => {
                const parsed = Math.trunc(Number(e.target.value))
                setIntervalCount(Number.isFinite(parsed) ? Math.max(1, parsed) : 1)
              }}
              aria-label="Interval count"
            />
            {INTERVAL_UNITS.map((u) => (
              <Chip key={u.value} selected={intervalUnit === u.value} onClick={() => setIntervalUnit(u.value)}>
                {u.label}
              </Chip>
            ))}
          </div>
        </div>

        <div className="sheet__field">
          <label className="text-caption-strong" htmlFor="recurring-next-run">
            Next run date
          </label>
          <input
            id="recurring-next-run"
            type="date"
            min={todayStr}
            className="sheet__note-input text-body"
            value={nextRunDate}
            onChange={(e) => setNextRunDate(e.target.value)}
          />
          {isPastDate && (
            <p className="text-caption recurring-form__error">
              Next run date can't be in the past — the server would generate a
              transaction for every missed date.
            </p>
          )}
        </div>

        <div className="sheet__field">
          <label className="text-caption-strong" htmlFor="recurring-note">
            Note
          </label>
          <input
            id="recurring-note"
            type="text"
            className="sheet__note-input text-body"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>
    </div>
  )
}
