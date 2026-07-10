import { Outlet } from 'react-router-dom'
import { BottomTabBar } from '../features/nav/BottomTabBar'
import './Layout.css'

export function Layout() {
  return (
    <div className="layout">
      <div className="layout__content">
        <Outlet />
      </div>
      <BottomTabBar />
    </div>
  )
}
