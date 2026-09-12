import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'

const KEY = 'tj-welcomed'
const SHOW_MS = 3600

/**
 * Full-screen "Welcome back, Adam" on the first paint of a session, held for
 * a few seconds, then faded out. Once per sign-in — the sessionStorage flag
 * lives exactly as long as the auth session does, so a refresh mid-session
 * doesn't replay it but the next sign-in does.
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
