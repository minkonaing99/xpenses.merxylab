import { Panel } from '../../ui/Panel'
import { formatTHB } from '../../lib/money'
import type { ReportAccount } from './api'
import './SummaryCards.css'

interface SummaryCardsProps {
  accounts: ReportAccount[]
  monthIncome: number
  monthExpense: number
  monthNet: number
}

export function SummaryCards({ accounts, monthIncome, monthExpense, monthNet }: SummaryCardsProps) {
  return (
    <Panel>
      <div className="text-section-header">This Month</div>
      <div className="summary-cards__net-row">
        <span
          className="text-amount tabular"
          style={{ color: monthNet >= 0 ? 'var(--color-success)' : 'var(--color-error)' }}
        >
          {monthNet >= 0 ? '+' : ''}
          {formatTHB(monthNet)}
        </span>
        <span className="text-caption">
          Income {formatTHB(monthIncome)} · Expense {formatTHB(monthExpense)}
        </span>
      </div>

      <div className="text-section-header">Accounts</div>
      {accounts.map((account) => (
        <div key={account.id} className="summary-cards__row">
          <span className="text-body">{account.name}</span>
          <span className="text-body-strong tabular">{formatTHB(account.balance)}</span>
        </div>
      ))}
    </Panel>
  )
}
