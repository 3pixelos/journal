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
    async (name, kind = 'strategy', color = '#a3a3a3') => {
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

/** The signed-in user's trading models, each with its confluence checks. */
export function useModels() {
  const { user } = useAuth()
  const [models, setModels] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user) return
    const [{ data: ms }, { data: cs }] = await Promise.all([
      supabase.from('models').select('*').eq('user_id', user.id)
        .order('sort_order').order('created_at'),
      supabase.from('model_checks').select('*').eq('user_id', user.id)
        .order('sort_order').order('created_at'),
    ])
    const byModel = {}
    for (const c of cs || []) (byModel[c.model_id] ||= []).push(c)
    setModels((ms || []).map((m) => ({ ...m, checks: byModel[m.id] || [] })))
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  /** Create a model and its confluence list in one go. */
  const createModel = useCallback(async (name, labels, note) => {
    const clean = name.trim()
    if (!clean) throw new Error('Give the model a name.')

    const { data: model, error } = await supabase
      .from('models')
      .insert({ user_id: user.id, name: clean, note: note?.trim() || null })
      .select()
      .single()
    if (error) {
      throw new Error(
        error.code === '23505' ? 'You already have a model with that name.' : error.message
      )
    }

    const rows = labels
      .map((l) => l.trim())
      .filter(Boolean)
      .map((label, i) => ({ model_id: model.id, user_id: user.id, label, sort_order: i + 1 }))

    let checks = []
    if (rows.length) {
      const { data } = await supabase.from('model_checks').insert(rows).select()
      checks = data || []
    }

    const full = { ...model, checks }
    setModels((prev) => [...prev, full])
    return full
  }, [user])

  const deleteModel = useCallback(async (id) => {
    await supabase.from('models').delete().eq('id', id)
    setModels((prev) => prev.filter((m) => m.id !== id))
  }, [])

  return { models, loading, reload: load, createModel, deleteModel }
}
