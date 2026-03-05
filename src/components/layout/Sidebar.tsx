import { NavLink } from 'react-router-dom'

const links = [
  { to: '/', label: 'Dashboard', icon: '◼' },
  { to: '/transaktioner', label: 'Transaktioner', icon: '≡' },
  { to: '/huvudbok', label: 'Huvudbok', icon: '⊞' },
  { to: '/momsrapport', label: 'Momsrapport', icon: '⊕' },
  { to: '/importera', label: 'Importera', icon: '⬆' },
  { to: '/assistent', label: 'Assistent', icon: '◆' },
]

export function Sidebar() {
  return (
    <aside className="w-56 flex-shrink-0 bg-neutral-950 border-r border-neutral-800 flex flex-col">
      <div className="px-5 py-6 border-b border-neutral-800">
        <div className="text-xs font-semibold text-sky-400 uppercase tracking-widest mb-0.5">
          Vantör Digital AB
        </div>
        <div className="text-lg font-bold text-neutral-100 leading-tight">
          Bokföring
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
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
  )
}
