import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const LINKS = [
  { to: '/', label: 'Dashboard', ico: '◧', end: true },
  { to: '/trades', label: 'Trades', ico: '▤' },
  { to: '/journal', label: 'Journal', ico: '✎' },
  { to: '/checklist', label: 'Checklist', ico: '✓' },
  { to: '/analytics', label: 'Analytics', ico: '◫' },
]

function toggleTheme() {
  const el = document.documentElement
  const next = el.dataset.theme === 'light' ? 'dark' : 'light'
  if (next === 'light') el.dataset.theme = 'light'
  else delete el.dataset.theme
  localStorage.setItem('tj-theme', next)
}

export default function Layout() {
  const { profile, user, signOut } = useAuth()
  const { pathname } = useLocation()
  const name = profile?.display_name || user?.email?.split('@')[0] || 'Trader'
  const title = LINKS.find((l) => l.to === pathname)?.label
    ?? (pathname === '/settings' ? 'Settings' : 'Trading Journal')

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-dot">TJ</span> Trading Journal
        </div>
        {LINKS.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end} className="navlink">
            <span className="ico">{l.ico}</span> {l.label}
          </NavLink>
        ))}
        <div className="spacer" />
        <NavLink to="/settings" className="navlink">
          <span className="ico">⚙</span> Settings
        </NavLink>
        <div
          className="row small"
          style={{ padding: '10px 10px 2px', borderTop: '1px solid var(--line)', marginTop: 8 }}
        >
          <div className="avatar">{name.slice(0, 1).toUpperCase()}</div>
          <div className="grow" style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {name}
            </div>
            <div className="tiny faint" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.email}
            </div>
          </div>
        </div>
        <button className="btn-ghost btn-sm" onClick={signOut} style={{ justifyContent: 'flex-start' }}>
          Sign out
        </button>
      </aside>

      <div className="main">
        <header className="topbar">
          <h1>{title}</h1>
          <div className="spacer" />
          <button className="btn-ghost btn-sm" onClick={toggleTheme} title="Toggle light / dark">
            ◐
          </button>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>

      <nav className="mobile-nav">
        {LINKS.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end} className="navlink">
            <span className="ico">{l.ico}</span>
            {l.label}
          </NavLink>
        ))}
        <NavLink to="/settings" className="navlink">
          <span className="ico">⚙</span>
          Settings
        </NavLink>
      </nav>
    </div>
  )
}
