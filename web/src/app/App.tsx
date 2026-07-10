import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, Outlet, useNavigate } from 'react-router-dom'
import { Layout } from './Layout'
import { TransactionsScreen } from '../features/transactions/TransactionsScreen'
import { BudgetsScreen } from '../features/budgets/BudgetsScreen'
import { ReportsScreen } from '../features/reports/ReportsScreen'
import { SettingsScreen } from '../features/settings/SettingsScreen'
import { CategoriesScreen } from '../features/categories/CategoriesScreen'
import { AccountsScreen } from '../features/accounts/AccountsScreen'
import { RecurringScreen } from '../features/recurring/RecurringScreen'
import { LoginScreen } from '../features/auth/LoginScreen'
import { me } from '../features/auth/api'
import { ApiClientError } from '../lib/fetchClient'
import { Skeleton } from '../ui/Skeleton'
import { Banner } from '../ui/Banner'
import { SyncBoot } from '../offline/SyncBoot'
import { db } from '../offline/db'

type AuthStatus = 'loading' | 'authed' | 'unauthed' | 'error'

function RequireAuth() {
  const [status, setStatus] = useState<AuthStatus>('loading')

  useEffect(() => {
    let cancelled = false
    me()
      .then(() => {
        if (!cancelled) setStatus('authed')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setStatus(err instanceof ApiClientError && err.status === 401 ? 'unauthed' : 'error')
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (status === 'loading') {
    return (
      <div className="screen screen__body">
        <Skeleton width="100%" height="120px" />
      </div>
    )
  }

  if (status === 'unauthed') {
    return <Navigate to="/login" replace />
  }

  if (status === 'error') {
    return (
      <div className="screen screen__body">
        <Banner tone="error" message="Couldn't reach the server. Check your connection and try again." />
      </div>
    )
  }

  return <Outlet />
}

export function AppRoutes() {
  const navigate = useNavigate()

  return (
    <Routes>
      <Route path="/login" element={<LoginScreen onSuccess={() => navigate('/', { replace: true })} />} />
      <Route element={<RequireAuth />}>
        <Route element={<SyncBoot db={db} />}>
          <Route element={<Layout />}>
            <Route index element={<TransactionsScreen db={db} />} />
            <Route path="reports" element={<ReportsScreen />} />
            <Route path="budgets" element={<BudgetsScreen db={db} />} />
            <Route path="settings" element={<SettingsScreen db={db} />} />
            <Route path="categories" element={<CategoriesScreen db={db} />} />
            <Route path="accounts" element={<AccountsScreen db={db} />} />
            <Route path="recurring" element={<RecurringScreen db={db} />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  )
}
