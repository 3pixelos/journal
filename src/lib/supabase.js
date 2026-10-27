import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Missing Supabase env vars. Create a .env.local with VITE_SUPABASE_URL and ' +
      'VITE_SUPABASE_ANON_KEY (see .env.example), then restart the dev server.'
  )
}

/**
 * Sessions live in sessionStorage, not localStorage, so closing the browser
 * ends the session and the next visit asks for a password again.
 *
 * sessionStorage alone is not enough: "continue where you left off" and
 * restored tabs bring sessionStorage back with them, so the session
 * survived a browser restart anyway. A heartbeat written while the tab is
 * open gives us a last-seen time — if that is stale on boot, the tab was
 * restored rather than merely refreshed, and the token is dropped before
 * the client ever reads it.
 */
const SEEN_KEY = 'tj-seen'
const HEARTBEAT_MS = 20000
// comfortably longer than the heartbeat, far shorter than a coffee break
const STALE_AFTER_MS = 90000

function dropStaleSession() {
  try {
    const seen = Number(window.sessionStorage.getItem(SEEN_KEY) || 0)
    const stale = !seen || Date.now() - seen > STALE_AFTER_MS
    if (stale) {
      for (const key of Object.keys(window.sessionStorage)) {
        if (key.startsWith('sb-') && key.includes('-auth-token')) {
          window.sessionStorage.removeItem(key)
        }
      }
      // a restored tab is a new visit, so the greeting plays again too
      window.sessionStorage.removeItem('tj-welcomed')
    }
    const beat = () => {
      try { window.sessionStorage.setItem(SEEN_KEY, String(Date.now())) } catch { /* no-op */ }
    }
    beat()
    setInterval(beat, HEARTBEAT_MS)
    document.addEventListener('visibilitychange', beat)
    window.addEventListener('pagehide', beat)
  } catch { /* storage unavailable — nothing to protect */ }
}

dropStaleSession()

/**
 * Falls back to an in-memory store where storage is blocked (private mode,
 * embedded webviews); the session then lasts only as long as the page.
 */
function sessionStore() {
  try {
    const probe = '__tj_probe__'
    window.sessionStorage.setItem(probe, '1')
    window.sessionStorage.removeItem(probe)
    return window.sessionStorage
  } catch {
    const mem = new Map()
    return {
      getItem: (k) => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => mem.set(k, v),
      removeItem: (k) => mem.delete(k),
    }
  }
}

// Clear tokens left behind by the previous localStorage-backed build, so an
// old persisted session cannot silently sign someone back in.
try {
  for (const key of Object.keys(window.localStorage)) {
    if (key.startsWith('sb-') && key.includes('-auth-token')) {
      window.localStorage.removeItem(key)
    }
  }
} catch { /* storage unavailable — nothing to clean up */ }

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: sessionStore(),
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

export const SCREENSHOT_BUCKET = 'trade-screenshots'

/**
 * Turn whatever the user typed into the email Supabase Auth needs.
 * An email passes straight through; a display name is resolved server-side.
 */
export async function resolveLoginEmail(identifier) {
  const raw = (identifier || '').trim()
  if (!raw) return null
  if (raw.includes('@')) return raw

  const { data, error } = await supabase.rpc('email_for_login', { identifier: raw })
  if (error) throw error
  return data || null
}
