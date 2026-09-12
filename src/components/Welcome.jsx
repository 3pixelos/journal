import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'

const KEY = 'tj-welcomed'
const SHOW_MS = 3600

/** Forget that we've welcomed this tab, so the next sign-in shows it again. */
export function resetWelcome() {
  try { sessionStorage.removeItem(KEY) } catch { /* private mode */ }
}

/**
 * Full-screen "Welcome back, Adam" right after signing in, held for a few
 * seconds, then faded out. Once per sign-in: the flag is cleared when you
 * sign out and when you submit the login form, so a refresh mid-session
 * doesn't replay it but every fresh sign-in does.
 */
export default function Welcome() {
  const { user, profile } = useAuth()
  const [show, setShow] = useState(() => {
    try { return !sessionStorage.getItem(KEY) } catch { return true }
  })

  useEffect(() => {
    if (!show) return
    try { sessionStorage.setItem(KEY, '1') } catch { /* private mode */ }
    const t = setTimeout(() => setShow(false), SHOW_MS)
    return () => clearTimeout(t)
  }, [show])

  if (!show || !user) return null

  const name =
    profile?.display_name ||
    user.user_metadata?.display_name ||
    user.email?.split('@')[0] ||
    'trader'

  // brand-new account: greet, don't "welcome back"
  const createdMs = user.created_at ? Date.now() - new Date(user.created_at).getTime() : Infinity
  const fresh = createdMs < 5 * 60 * 1000

  return (
    <div className="welcome" role="status" aria-live="polite">
      <div className="welcome-inner">
        <h1>{fresh ? 'Welcome' : 'Welcome Back'}, {name}</h1>
        <div className="welcome-line" />
      </div>
    </div>
  )
}
