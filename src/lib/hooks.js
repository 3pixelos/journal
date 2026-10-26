import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { signPaths } from './storage'
import { useAuth } from '../context/AuthContext'

/**
 * Signed URLs for a list of storage paths, refreshed when the list changes.
 * Reports whether it is still working and why it failed, so a broken image
 * can say so instead of sitting as a grey box.
 */
export function useSignedUrls(paths) {
  const [state, setState] = useState({ urls: {}, error: null, loading: false })
  const key = [...new Set(paths.filter(Boolean))].sort().join('|')

  useEffect(() => {
    let alive = true
    if (!key) {
      setState({ urls: {}, error: null, loading: false })
      return
    }
    setState((s) => ({ ...s, loading: true }))
    signPaths(key.split('|'))
      .then((r) => alive && setState({ urls: r.urls, error: r.error, loading: false }))
      .catch((e) => alive && setState({
        urls: {}, error: e.message || 'Could not load images.', loading: false,
      }))
    return () => { alive = false }
  }, [key])

  return state
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

/** The signed-in user's trading models, each with its ordered steps. */
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

  /** Create a model and its list of steps in one go. */
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

/**
 * Count a figure up to its value on mount and whenever it changes.
 *
 * Eased rather than linear so it decelerates into the real number, and
 * skipped entirely under reduced motion — an animated P&L is decoration,
 * and the true figure must never be more than a frame away.
 */
export function useCountUp(target, ms = 700) {
  const to = Number(target) || 0
  const [value, setValue] = useState(to)
  const from = useRef(to)

  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const start = from.current
    if (reduced || start === to) {
      from.current = to
      setValue(to)
      return
    }

    let raf
    const t0 = performance.now()
    const tick = (now) => {
      const p = Math.min((now - t0) / ms, 1)
      // easeOutExpo
      const e = p === 1 ? 1 : 1 - Math.pow(2, -10 * p)
      setValue(start + (to - start) * e)
      if (p < 1) raf = requestAnimationFrame(tick)
      else from.current = to
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [to, ms])

  return value
}
