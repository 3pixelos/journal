import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const ROTATE_MS = 7000
const FADE_MS = 350

/**
 * One trading rule at a time in the corner, cycling slowly — so the thing you
 * keep breaking is in front of you at the moment you would break it.
 */
export default function ReminderTicker() {
  const { user } = useAuth()
  const [rules, setRules] = useState([])
  const [index, setIndex] = useState(0)
  const [fading, setFading] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('reminders')
      .select('id, text, note')
      .eq('user_id', user.id)
      .order('sort_order')
      .order('created_at')
    setRules(data || [])
  }, [user])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (rules.length < 2) return
    const tick = setInterval(() => {
      setFading(true)
      setTimeout(() => {
        setIndex((i) => (i + 1) % rules.length)
        setFading(false)
      }, FADE_MS)
    }, ROTATE_MS)
    return () => clearInterval(tick)
  }, [rules.length])

  if (dismissed || rules.length === 0) return null

  const rule = rules[index % rules.length]
  if (!rule) return null

  return (
    <aside className="ticker" aria-live="polite">
      <span className="rnum">{(index % rules.length) + 1}</span>
      <div className={`ticker-body grow ${fading ? 'out' : ''}`}>
        <div className="ticker-text">{rule.text}</div>
        {rule.note && <div className="ticker-note">{rule.note}</div>}
      </div>
      <button
        className="ticker-x"
        onClick={() => setDismissed(true)}
        title="Hide until you reload"
        aria-label="Hide reminders"
      >
        ✕
      </button>
      {rules.length > 1 && (
        <div className="ticker-dots">
          {rules.map((r, i) => (
            <i key={r.id} className={i === index % rules.length ? 'on' : ''} />
          ))}
        </div>
      )}
    </aside>
  )
}
