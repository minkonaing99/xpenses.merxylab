import { useEffect, useMemo, useState } from 'react'
import { Skeleton } from '../../ui/Skeleton'
import { Banner } from '../../ui/Banner'
import { SummaryCards } from './SummaryCards'
import { CategoryChart } from './CategoryChart'
import { getCategorySpend, getSummary, type CategorySpend, type ReportSummary } from './api'
import './ReportsScreen.css'

export function ReportsScreen() {
  const month = useMemo(() => new Date().toISOString().slice(0, 7), [])
  const [categorySpend, setCategorySpend] = useState<CategorySpend[] | null>(null)
  const [summary, setSummary] = useState<ReportSummary | null>(null)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([getCategorySpend(month), getSummary(month)])
      .then(([spend, summ]) => {
        if (cancelled) return
        setCategorySpend(spend)
        setSummary(summ)
        setLoadError(false)
      })
      .catch(() => {
        if (!cancelled) setLoadError(true)
      })
    return () => {
      cancelled = true
    }
  }, [month])

  return (
    <div className="screen">
      <div className="screen__header">
        <div className="text-screen-title">Reports</div>
        <div className="text-caption">{month} spend by category</div>
      </div>

      {loadError && (
        <div className="screen__banner">
          <Banner tone="error" message="Couldn't load reports. Check your connection and try again." />
        </div>
      )}

      <div className="screen__body reports__body">
        {summary ? (
          <SummaryCards
            accounts={summary.accounts}
            monthIncome={summary.monthIncome}
            monthExpense={summary.monthExpense}
            monthNet={summary.monthNet}
          />
        ) : (
          <Skeleton width="100%" height="160px" />
        )}

        {categorySpend ? (
          <CategoryChart categorySpend={categorySpend} />
        ) : (
          <Skeleton width="100%" height="160px" />
        )}
      </div>
    </div>
  )
}
