import { Panel } from '../../ui/Panel'
import { ProgressBar } from '../../ui/ProgressBar'
import { EmptyState } from '../../ui/EmptyState'
import { formatTHB } from '../../lib/money'
import type { CategorySpend } from './api'
import './CategoryChart.css'

interface CategoryChartProps {
  categorySpend: CategorySpend[]
}

export function CategoryChart({ categorySpend }: CategoryChartProps) {
  if (categorySpend.length === 0) {
    return <EmptyState title="No spending yet" description="Category breakdown appears once you log an expense this month." />
  }

  const total = categorySpend.reduce((sum, c) => sum + c.total, 0)

  return (
    <Panel>
      <div className="category-chart__total-row">
        <span className="text-section-header">Spend by Category</span>
        <span className="text-caption tabular">Total {formatTHB(total)}</span>
      </div>
      {categorySpend.map((c) => (
        <div key={c.categoryId} className="category-chart__row">
          <div className="category-chart__row-top">
            <span className="text-body">{c.name}</span>
            <span className="text-body-strong tabular">{formatTHB(c.total)}</span>
          </div>
          <ProgressBar value={c.total} max={total} color="var(--color-primary)" height={8} />
        </div>
      ))}
    </Panel>
  )
}
