import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'

export function Shell() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const [lastPathname, setLastPathname] = useState(location.pathname)

  if (location.pathname !== lastPathname) {
    setLastPathname(location.pathname)
    setSidebarOpen(false)
  }

  return (
    <div className="flex h-screen bg-neutral-950 text-neutral-100 overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="md:hidden flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b border-neutral-800">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Öppna meny"
            className="p-1.5 -ml-1.5 text-neutral-400 hover:text-neutral-100"
          >
            <span className="text-xl leading-none">☰</span>
          </button>
          <span className="text-sm font-semibold text-neutral-100">Vantör Bokföring</span>
        </header>
        <main className="flex-1 overflow-y-auto flex flex-col">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
