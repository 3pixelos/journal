import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { PresenceBar } from './Presence'

const LINKS = [
  { to: '/', label: 'Dashboard', ico: '◧', end: true },
  { to: '/trades', label: 'Trades', ico: '▤' },
  { to: '/journal', label: 'Journal', ico: '✎' },
  { to: '/reminders', label: 'Reminders', ico: '◆' },
]

function applyTheme(next) {
  const el = document.documentElement
  if (next === 'light') el.dataset.theme = 'light'
  else delete el.dataset.theme
  try { localStorage.setItem('tj-theme', next) } catch { /* private mode */ }
}

export default function Layout() {
  const { profile, user, signOut } = useAuth()
  const [theme, setTheme] = useState(
    () => document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
  )
  const { pathname } = useLocation()
  const name = profile?.display_name || user?.email?.split('@')[0] || 'Trader'
  const title = LINKS.find((l) => l.to === pathname)?.label
    ?? (pathname === '/settings' ? 'Settings'
      : pathname === '/floor' ? 'Trading floor' : 'Trading Journal')

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
        <NavLink to="/floor" className="navlink">
          <span className="ico">◍</span> Trading floor
        </NavLink>
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
          <PresenceBar />
          <button
            className="btn-sm"
            onClick={() => {
              const next = theme === 'light' ? 'dark' : 'light'
              setTheme(next)
              applyTheme(next)
            }}
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            {theme === 'light' ? '☾ Dark' : '☀ Light'}
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
        <NavLink to="/floor" className="navlink">
          <span className="ico">◍</span>
          Floor
        </NavLink>
        <NavLink to="/settings" className="navlink">
          <span className="ico">⚙</span>
          Settings
        </NavLink>
      </nav>
    </div>
  )
}
