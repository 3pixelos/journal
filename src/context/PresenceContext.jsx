import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const PresenceCtx = createContext({ online: [], roster: [], loading: true })

const ROSTER_MS = 5000      // re-read who's around and when they were last seen
const HEARTBEAT_MS = 30000  // write our own last_seen_at

/**
 * Live presence over a shared Realtime channel, plus a `last_seen_at`
 * heartbeat so an offline trader still shows "active 20m ago".
 */
export function PresenceProvider({ children }) {
  const { user, profile } = useAuth()
  const { pathname } = useLocation()
  const [online, setOnline] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)

  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'Trader'

  // ---- everyone who has an account, with their last-seen stamp ---------
  useEffect(() => {
    if (!user) return
    let alive = true
    const fetchProfiles = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, display_name, last_seen_at, avatar')
        .order('display_name')
      if (alive) {
        setProfiles(data || [])
        setLoading(false)
      }
    }
    // Poll only while the tab is actually being looked at; a hidden tab
    // catches up the moment it comes back.
    const tick = () => { if (document.visibilityState === 'visible') fetchProfiles() }
    fetchProfiles()
    const t = setInterval(tick, ROSTER_MS)
    document.addEventListener('visibilitychange', tick)
    return () => {
      alive = false
      clearInterval(t)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [user])

  // ---- realtime presence channel --------------------------------------
  useEffect(() => {
    if (!user) return
    const channel = supabase.channel('trading-floor', {
      config: { presence: { key: user.id } },
    })

    const sync = () => {
      const state = channel.presenceState()
      const rows = Object.entries(state).map(([id, metas]) => ({
        id,
        ...(metas[metas.length - 1] || {}),
      }))
      setOnline(rows)
    }

    channel
      .on('presence', { event: 'sync' }, sync)
      .on('presence', { event: 'join' }, sync)
      .on('presence', { event: 'leave' }, sync)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            display_name: displayName,
            page: pathname,
            online_at: new Date().toISOString(),
          })
        }
      })

    return () => { supabase.removeChannel(channel) }
  }, [user, displayName])

  // ---- tell the channel which page we are on --------------------------
  useEffect(() => {
    if (!user) return
    const ch = supabase.getChannels().find((c) => c.topic === 'realtime:trading-floor')
    if (ch?.state === 'joined') {
      ch.track({ display_name: displayName, page: pathname, online_at: new Date().toISOString() })
    }
  }, [pathname, user, displayName])

  // ---- last_seen_at heartbeat -----------------------------------------
  useEffect(() => {
    if (!user) return
    const beat = () => {
      if (document.visibilityState === 'visible') supabase.rpc('touch_last_seen')
    }
    beat()
    const t = setInterval(beat, HEARTBEAT_MS)
    document.addEventListener('visibilitychange', beat)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', beat) }
  }, [user])

  /** Everyone who has an account, online ones first. */
  const roster = useMemo(() => {
    const onlineById = new Map(online.map((o) => [o.id, o]))
    return profiles
      .map((p) => ({
        ...p,
        isOnline: onlineById.has(p.id),
        page: onlineById.get(p.id)?.page,
        isMe: p.id === user?.id,
      }))
      .sort((a, b) =>
        Number(b.isOnline) - Number(a.isOnline) ||
        Number(a.isMe) - Number(b.isMe) ||
        (a.display_name || '').localeCompare(b.display_name || '')
      )
  }, [profiles, online, user])

  return (
    <PresenceCtx.Provider value={{ online, roster, loading }}>
      {children}
    </PresenceCtx.Provider>
  )
}

export const usePresence = () => useContext(PresenceCtx)

/** Human label for a page path, used in "Adam · on Trades". */
export function pageLabel(path) {
  if (!path) return null
  const map = {
    '/': 'Dashboard',
    '/trades': 'Trades',
    '/journal': 'Journal',
    '/reminders': 'Reminders',
    '/settings': 'Settings',
  }
  return map[path] || null
}
