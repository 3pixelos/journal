import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { signPaths } from './storage'
import { useAuth } from '../context/AuthContext'

/** Signed URLs for a list of storage paths, refreshed when the list changes. */
export function useSignedUrls(paths) {
  const [urls, setUrls] = useState({})
  const key = [...new Set(paths.filter(Boolean))].sort().join('|')

  useEffect(() => {
    let alive = true
    if (!key) {
      setUrls({})
      return
    }
    signPaths(key.split('|')).then((m) => alive && setUrls(m))
    return () => { alive = false }
  }, [key])

  return urls
}

/** The signed-in user's tags, with a create helper. */
export function useTags() {
  const { user } = useAuth()
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('tags')
      .select('*')
      .eq('user_id', user.id)
      .order('kind')
      .order('name')
    setTags(data || [])
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  const createTag = useCallback(
    async (name, kind = 'strategy', color = '#5b8cff') => {
      const clean = name.trim()
      if (!clean) return null
      const existing = tags.find(
        (t) => t.name.toLowerCase() === clean.toLowerCase() && t.kind === kind
      )
      if (existing) return existing
      const { data, error } = await supabase
        .from('tags')
        .insert({ user_id: user.id, name: clean, kind, color })
        .select()
        .single()
      if (error) throw error
      setTags((prev) => [...prev, data])
      return data
    },
    [tags, user]
  )

  const deleteTag = useCallback(async (id) => {
    await supabase.from('tags').delete().eq('id', id)
    setTags((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return { tags, loading, reload: load, createTag, deleteTag }
}

/** The signed-in user's trading accounts. */
export function useAccounts() {
  const { user } = useAuth()
  const [accounts, setAccounts] = useState([])

  const load = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at')
    setAccounts(data || [])
  }, [user])

  useEffect(() => { load() }, [load])
  return { accounts, reload: load }
}

/** Sticky document title. */
export function useTitle(t) {
  useEffect(() => {
    document.title = t ? `${t} · Trading Journal` : 'Trading Journal'
  }, [t])
}

/** Latest-value ref, for stable callbacks. */
export function useLatest(v) {
  const ref = useRef(v)
  ref.current = v
  return ref
}
