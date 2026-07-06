import { NavLink } from 'react-router-dom'

const links = [
  { to: '/', label: 'Dashboard', icon: '◼' },
  { to: '/transaktioner', label: 'Transaktioner', icon: '≡' },
  { to: '/huvudbok', label: 'Huvudbok', icon: '⊞' },
  { to: '/momsrapport', label: 'Momsrapport', icon: '⊕' },
  { to: '/importera', label: 'Importera', icon: '⬆' },
  { to: '/assistent', label: 'Assistent', icon: '◆' },
]

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export function Sidebar({ open, onClose }: SidebarProps) {
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 flex-shrink-0 bg-neutral-950 border-r border-neutral-800 flex flex-col transition-transform duration-200 ease-out md:static md:z-auto md:w-56 md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="px-5 py-6 border-b border-neutral-800 flex items-start justify-between">
          <div>
            <div className="text-xs font-semibold text-sky-400 uppercase tracking-widest mb-0.5">
              Vantör Digital AB
            </div>
            <div className="text-lg font-bold text-neutral-100 leading-tight">
              Bokföring
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Stäng meny"
            className="md:hidden text-neutral-500 hover:text-neutral-300 p-1 -mr-1"
          >
            ✕
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5 overflow-y-auto">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? 'bg-sky-600/20 text-sky-400 font-medium'
                    : 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800'
                }`
              }
            >
              <span className="text-base w-4 text-center opacity-70">{link.icon}</span>
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-5 py-4 border-t border-neutral-800">
          <div className="text-xs text-neutral-600">MVP v1.0</div>
        </div>
      </aside>
    </>
  )
}
