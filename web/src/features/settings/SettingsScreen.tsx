import { Link } from 'react-router-dom'
import { CaretRight } from '@phosphor-icons/react'
import { Panel } from '../../ui/Panel'
import { Banner } from '../../ui/Banner'
import { useOutboxStatus } from '../../offline/hooks'
import type { XpensesDb } from '../../offline/db'
import './SettingsScreen.css'

const MANAGE_LINKS = [
  { to: '/accounts', label: 'Accounts' },
  { to: '/categories', label: 'Categories' },
  { to: '/recurring', label: 'Recurring' },
]

interface SettingsScreenProps {
  db: XpensesDb
}

export function SettingsScreen({ db }: SettingsScreenProps) {
  const outboxStatus = useOutboxStatus(db)
  const failedCount = outboxStatus?.failed ?? 0

  return (
    <div className="screen">
      <div className="screen__header">
        <div className="text-screen-title">Settings</div>
      </div>

      {failedCount > 0 && (
        <div className="screen__banner">
          <Banner
            tone="error"
            message={`${failedCount} change${failedCount === 1 ? '' : 's'} couldn't sync. Edit and save again to retry.`}
          />
        </div>
      )}

      <div className="screen__body">
        <Panel>
          <div className="screen__section-header text-section-header">Manage</div>
          {MANAGE_LINKS.map(({ to, label }) => (
            <Link key={to} to={to} className="settings__row">
              <span className="text-body">{label}</span>
              <CaretRight size={18} aria-hidden="true" />
            </Link>
          ))}
        </Panel>
      </div>
    </div>
  )
}
