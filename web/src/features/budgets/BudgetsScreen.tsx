import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Trash } from '@phosphor-icons/react'
import { Panel } from '../../ui/Panel'
import { Button } from '../../ui/Button'
import { ProgressBar } from '../../ui/ProgressBar'
import { EmptyState } from '../../ui/EmptyState'
import { AmountInput } from '../../ui/AmountInput'
import { TXN_ICON_COMPONENTS } from '../../ui/TxnRow'
import { formatTHB } from '../../lib/money'
import { useBudgets, useCategories } from '../../offline/hooks'
import { createBudget, updateBudget, deleteBudget } from '../../offline/mutations'
import { iconForTxn } from '../transactions/txnMapping'
import { CategoryPicker } from '../categories/CategoryPicker'
import { BudgetBanner } from './BudgetBanner'
import { getBudgets, type ApiBudget } from './api'
import type { XpensesDb } from '../../offline/db'
import './BudgetsScreen.css'

const LIVE_REFRESH_MS = 30_000

function amountColor(spentSatang: number, limitSatang: number): string {
  const ratio = spentSatang / limitSatang
  if (ratio > 1) return 'var(--color-error)'
  if (ratio >= 0.9) return 'var(--color-warning)'
  return 'var(--color-muted-strong)'
}

interface BudgetsScreenProps {
  db: XpensesDb
}

export function BudgetsScreen({ db }: BudgetsScreenProps) {
  const month = useMemo(() => new Date().toISOString().slice(0, 7), [])
  const cachedBudgets = useBudgets(db)
  const categories = useCategories(db)
  const [liveBudgets, setLiveBudgets] = useState<ApiBudget[] | null>(null)
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [limitAmount, setLimitAmount] = useState(0)
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    function refetch() {
      getBudgets(month)
        .then((rows) => {
          if (!cancelled) setLiveBudgets(rows)
        })
        .catch(() => undefined) // offline: fall back to cached limits below, spent unknown
    }
    // Refetch immediately on any local budget write (create/delete/limit
    // edit), AND on a fixed interval — spent/over changes whenever a
    // transaction is added/edited/deleted anywhere in the app, which never
    // touches the budgets table itself, so a cachedBudgets-only trigger
    // would leave this screen showing a stale (or masked over-budget)
    // spent/over indefinitely between budget edits.
    refetch()
    const interval = setInterval(refetch, LIVE_REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [month, cachedBudgets])

  const categoriesById = useMemo(() => new Map((categories ?? []).map((c) => [c.id, c])), [categories])
  const liveById = useMemo(() => new Map((liveBudgets ?? []).map((b) => [b.id, b])), [liveBudgets])
  const budgetsWithCategoriesTaken = new Set((cachedBudgets ?? []).map((b) => b.categoryId))

  const displayBudgets = (cachedBudgets ?? []).map((b) => {
    const live = liveById.get(b.id)
    return {
      id: b.id,
      categoryId: b.categoryId,
      categoryName: categoriesById.get(b.categoryId)?.name ?? 'Category',
      limitAmount: b.limitAmount,
      spent: live?.spent ?? 0,
      over: live?.over ?? false,
    }
  })

  const overBudget = displayBudgets.find((b) => b.over)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (limitAmount <= 0) return
    if (editingId) {
      await updateBudget(db, editingId, limitAmount)
      setEditingId(null)
    } else {
      if (!categoryId) return
      await createBudget(db, { categoryId, limitAmount })
    }
    setCategoryId(null)
    setLimitAmount(0)
  }

  function startEdit(budgetId: string, currentLimit: number) {
    setEditingId(budgetId)
    setLimitAmount(currentLimit)
  }

  function cancelEdit() {
    setEditingId(null)
    setCategoryId(null)
    setLimitAmount(0)
  }

  return (
    <div className="screen">
      <div className="screen__header">
        <div className="text-screen-title">Budgets</div>
        <div className="text-caption">
          {month} · {displayBudgets.length} categories tracked
        </div>
      </div>

      {overBudget && !bannerDismissed && (
        <div className="screen__banner">
          <BudgetBanner
            categoryName={overBudget.categoryName}
            spent={overBudget.spent}
            limitAmount={overBudget.limitAmount}
            onDismiss={() => setBannerDismissed(true)}
          />
        </div>
      )}

      <div className="screen__body">
        <Panel>
          <form className="budgets__form" onSubmit={handleSubmit}>
            {!editingId && (
              <>
                <div className="text-caption-strong">Category</div>
                <CategoryPicker
                  db={db}
                  value={categoryId}
                  onChange={setCategoryId}
                  excludeIds={budgetsWithCategoriesTaken}
                />
              </>
            )}
            <div className="text-caption-strong">Monthly limit</div>
            <AmountInput valueSatang={limitAmount} onChange={setLimitAmount} variant="field" />
            <div className="budgets__form-actions">
              <Button type="submit" disabled={(!editingId && !categoryId) || limitAmount <= 0}>
                {editingId ? 'Save' : 'Add'}
              </Button>
              {editingId && (
                <Button type="button" variant="secondary" onClick={cancelEdit}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </Panel>

        {displayBudgets.length === 0 ? (
          <EmptyState title="No budgets yet" description="Set a monthly limit for a category above." />
        ) : (
          <Panel>
            <div className="screen__section-header text-section-header">Category limits</div>
            {displayBudgets.map((b) => {
              const Icon = TXN_ICON_COMPONENTS[iconForTxn('expense', b.categoryName)]
              const color = amountColor(b.spent, b.limitAmount)
              return (
                <div key={b.id} className="budget-row">
                  <div className="budget-row__top">
                    <button
                      type="button"
                      className="budget-row__label"
                      aria-label={`Edit ${b.categoryName} budget`}
                      onClick={() => startEdit(b.id, b.limitAmount)}
                    >
                      <Icon size={18} weight="fill" color={color} aria-hidden={true} />
                      <span className="text-body-strong">{b.categoryName}</span>
                    </button>
                    <span className="text-caption-strong tabular" style={{ color }}>
                      {formatTHB(b.spent)} / {formatTHB(b.limitAmount)}
                    </span>
                    <button
                      type="button"
                      className="budget-row__delete"
                      aria-label={`Delete ${b.categoryName} budget`}
                      onClick={() => deleteBudget(db, b.id)}
                    >
                      <Trash size={16} aria-hidden="true" />
                    </button>
                  </div>
                  <ProgressBar value={b.spent} max={b.limitAmount} color={color} />
                </div>
              )
            })}
          </Panel>
        )}
      </div>
    </div>
  )
}
