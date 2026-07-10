import { NavLink } from 'react-router-dom'
import { ListBullets, ChartDonut, Wallet, Gear } from '@phosphor-icons/react'
import './BottomTabBar.css'

const TABS = [
  { to: '/', label: 'Transactions', icon: ListBullets },
  { to: '/reports', label: 'Reports', icon: ChartDonut },
  { to: '/budgets', label: 'Budgets', icon: Wallet },
  { to: '/settings', label: 'Settings', icon: Gear },
]

export function BottomTabBar() {
  return (
    <nav className="tabbar">
      {TABS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) => `tabbar__item${isActive ? ' tabbar__item--active' : ''}`}
        >
          {({ isActive }) => (
            <>
              <Icon size={24} weight={isActive ? 'fill' : 'regular'} aria-hidden="true" />
              <span className={isActive ? 'text-caption-strong' : 'text-caption'}>{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
