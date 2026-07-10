import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import type { XpensesDb } from './db'
import { pull, push } from './sync'
import { Skeleton } from '../ui/Skeleton'

const SYNC_INTERVAL_MS = 5 * 60 * 1000

interface SyncBootProps {
  db: XpensesDb
}

// Gates the app on one initial pull so a cold cache doesn't render an empty
// screen indistinguishable from "you have no data." Never blocks on network
// failure, though — an offline device must still see whatever is cached,
// which is the entire point of the offline engine this wraps.
export function SyncBoot({ db }: SyncBootProps) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    pull(db)
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [db])

  useEffect(() => {
    function syncNow() {
      pull(db).catch(() => undefined)
      push(db).catch(() => undefined)
    }
    window.addEventListener('online', syncNow)
    const interval = setInterval(syncNow, SYNC_INTERVAL_MS)
    return () => {
      window.removeEventListener('online', syncNow)
      clearInterval(interval)
    }
  }, [db])

  if (!ready) {
    return (
      <div className="screen screen__body">
        <Skeleton width="100%" height="120px" />
      </div>
    )
  }

  return <Outlet />
}
