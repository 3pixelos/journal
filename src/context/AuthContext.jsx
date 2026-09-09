import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return
      setSession(data.session ?? null)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s ?? null)
      setLoading(false)
    })
    return () => {
      alive = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const user = session?.user ?? null

  const loadMeta = useCallback(async () => {
    if (!user) {
      setProfile(null)
      setSettings(null)
      return
    }
    const [{ data: p }, { data: s }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      supabase.from('settings').select('*').eq('user_id', user.id).maybeSingle(),
    ])

    // Fallback for accounts created before the bootstrap trigger existed.
    if (!p) {
      const name = user.user_metadata?.display_name || user.email?.split('@')[0] || 'Trader'
      const { data: created } = await supabase
        .from('profiles')
        .insert({ id: user.id, display_name: name })
        .select()
        .maybeSingle()
      setProfile(created ?? { id: user.id, display_name: name })
    } else {
      setProfile(p)
    }

    if (!s) {
      const { data: created } = await supabase
        .from('settings')
        .insert({ user_id: user.id })
        .select()
        .maybeSingle()
      setSettings(created ?? null)
    } else {
      setSettings(s)
    }
  }, [user])

  useEffect(() => {
    loadMeta()
  }, [loadMeta])

  const value = {
    session,
    user,
    profile,
    settings,
    loading,
    refreshMeta: loadMeta,
    setProfile,
    setSettings,
    signOut: () => supabase.auth.signOut(),
  }

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export const useAuth = () => {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
