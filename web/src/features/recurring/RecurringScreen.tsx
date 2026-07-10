import { useMemo, useState } from 'react'
import { Plus, Play, Pause, Trash } from '@phosphor-icons/react'
import { Panel } from '../../ui/Panel'
import { EmptyState } from '../../ui/EmptyState'
import { TXN_ICON_COMPONENTS } from '../../ui/TxnRow'
import { formatTHB } from '../../lib/money'
import { useRecurringRules, useCategories, useAccounts } from '../../offline/hooks'
import { updateRecurringRule, deleteRecurringRule } from '../../offline/mutations'
import { iconForTxn } from '../transactions/txnMapping'
import { RecurringForm } from './RecurringForm'
import type { XpensesDb } from '../../offline/db'
import './RecurringScreen.css'

interface RecurringScreenProps {
  db: XpensesDb
}

export function RecurringScreen({ db }: RecurringScreenProps) {
  const rules = useRecurringRules(db)
  const categories = useCategories(db)
  const accounts = useAccounts(db)
  const [formOpen, setFormOpen] = useState(false)

  const categoriesById = useMemo(() => new Map((categories ?? []).map((c) => [c.id, c])), [categories])
  const accountsById = useMemo(() => new Map((accounts ?? []).map((a) => [a.id, a])), [accounts])

  function labelFor(rule: NonNullable<typeof rules>[number]): string {
    if (rule.type === 'expense') return categoriesById.get(rule.categoryId ?? '')?.name ?? 'Uncategorized'
    if (rule.type === 'income') return accountsById.get(rule.accountId ?? '')?.name ?? 'Income'
    const from = accountsById.get(rule.fromAccountId ?? '')?.name ?? '?'
    const to = accountsById.get(rule.toAccountId ?? '')?.name ?? '?'
    return `${from} → ${to}`
  }

  // Pausing never advances nextRunDate server-side. Resuming a rule whose
  // nextRunDate has drifted into the past would hit the server's catch-up
  // scheduler on the next cron tick, generating one real transaction per
  // missed occurrence — surprising and hard to undo for a solo user with no
  // confirmation step. Reschedule to today on resume instead of catching up.
  function toggleActive(ruleId: string, active: boolean, nextRunDate: string) {
    const today = new Date().toISOString().slice(0, 10)
    if (!active && nextRunDate < today) {
      updateRecurringRule(db, ruleId, { active: true, nextRunDate: today })
      return
    }
    updateRecurringRule(db, ruleId, { active: !active })
  }

  return (
    <div className="screen">
      <div className="screen__header">
        <div className="text-screen-title">Recurring</div>
      </div>

      <div className="screen__body">
        {rules !== undefined && rules.length === 0 ? (
          <EmptyState title="No recurring transactions" description="Tap the + button to set up a repeating bill or income." />
        ) : (
          <Panel>
            {rules?.map((rule) => {
              const label = labelFor(rule)
              const categoryName = rule.type === 'expense' ? categoriesById.get(rule.categoryId ?? '')?.name : undefined
              const Icon = TXN_ICON_COMPONENTS[iconForTxn(rule.type as 'expense' | 'income' | 'transfer', categoryName)]
              const intervalLabel = `Every ${rule.intervalCount > 1 ? `${rule.intervalCount} ${rule.intervalUnit}s` : rule.intervalUnit}`
              return (
                <div key={rule.id} className="recurring-row">
                  <div className="recurring-row__icon">
                    <Icon size={18} weight="fill" aria-hidden={true} />
                  </div>
                  <div className="recurring-row__text">
                    <span className="text-body-strong">{label}</span>
                    <span className="text-caption">
                      {intervalLabel} · next {rule.nextRunDate}
                    </span>
                  </div>
                  <span className="text-body-strong tabular">{formatTHB(rule.amount)}</span>
                  <button
                    type="button"
                    className="recurring-row__action"
                    aria-label={`${rule.active ? 'Pause' : 'Resume'} ${label}`}
                    onClick={() => toggleActive(rule.id, rule.active, rule.nextRunDate)}
                  >
                    {rule.active ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
                  </button>
                  <button
                    type="button"
                    className="recurring-row__action"
                    aria-label={`Delete ${label}`}
                    onClick={() => deleteRecurringRule(db, rule.id)}
                  >
                    <Trash size={16} aria-hidden="true" />
                  </button>
                </div>
              )
            })}
          </Panel>
        )}
      </div>

      <button type="button" className="screen__fab" aria-label="Add recurring" onClick={() => setFormOpen(true)}>
        <Plus size={24} weight="bold" aria-hidden="true" />
      </button>

      {formOpen && <RecurringForm db={db} onClose={() => setFormOpen(false)} />}
    </div>
  )
}
