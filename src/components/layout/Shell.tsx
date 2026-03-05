import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'

export function Shell() {
  return (
    <div className="flex h-screen bg-neutral-950 text-neutral-100 overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
