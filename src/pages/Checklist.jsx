import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useTitle } from '../lib/hooks'
import { todayStr, addDays, longDate, shortDate } from '../lib/format'
import { checklistRatios, currentStreak, longestStreak, dateRange } from '../lib/calc'
import { Card, Stat, Empty, Loading, Field, DeleteButton } from '../components/ui'

const HISTORY_DAYS = 84 // 12 weeks

export default function Checklist() {
  useTitle('Checklist')
  const { user } = useAuth()

  const [items, setItems] = useState([])
  const [logs, setLogs] = useState([])
  const [date, setDate] = useState(todayStr())
  const [loading, setLoading] = useState(true)
  const [newLabel, setNewLabel] = useState('')
  const [manage, setManage] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const [{ data: it }, { data: lg }] = await Promise.all([
      supabase.from('checklist_items').select('*').eq('user_id', user.id).order('sort_order'),
      supabase
        .from('checklist_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('log_date', addDays(todayStr(), -365)),
    ])
    setItems(it || [])
    setLogs(lg || [])
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  const activeItems = useMemo(() => items.filter((i) => i.is_active), [items])

  const doneToday = useMemo(() => {
    const set = new Set(
      logs.filter((l) => l.log_date === date && l.completed).map((l) => l.item_id)
    )
    return set
  }, [logs, date])

  const ratios = useMemo(
    () => checklistRatios(logs, activeItems.length),
    [logs, activeItems.length]
  )

  const streak = currentStreak(ratios, todayStr())
  const best = longestStreak(ratios)

  const last30 = useMemo(() => {
    const days = dateRange(addDays(todayStr(), -29), todayStr())
    const complete = days.filter((d) => (ratios[d] ?? 0) >= 1).length
    return { complete, total: days.length }
  }, [ratios])

  const history = useMemo(() => {
    const from = addDays(todayStr(), -(HISTORY_DAYS - 1))
    return dateRange(from, todayStr()).map((d) => ({ date: d, ratio: ratios[d] ?? 0 }))
  }, [ratios])

  async function toggle(item) {
    if (saving) return
    setSaving(true)
    const isDone = doneToday.has(item.id)
    // optimistic
    setLogs((prev) => {
      const others = prev.filter((l) => !(l.item_id === item.id && l.log_date === date))
      return isDone
        ? others
        : [...others, { id: `tmp-${item.id}`, item_id: item.id, log_date: date, completed: true }]
    })
    try {
      if (isDone) {
        await supabase
          .from('checklist_logs')
          .delete()
          .eq('user_id', user.id)
          .eq('item_id', item.id)
          .eq('log_date', date)
      } else {
        await supabase.from('checklist_logs').upsert(
          { user_id: user.id, item_id: item.id, log_date: date, completed: true },
          { onConflict: 'user_id,item_id,log_date' }
        )
      }
    } finally {
      setSaving(false)
      load()
    }
  }

  async function addItem(e) {
    e.preventDefault()
    const label = newLabel.trim()
    if (!label) return
    const sort = Math.max(0, ...items.map((i) => i.sort_order)) + 1
    await supabase.from('checklist_items').insert({ user_id: user.id, label, sort_order: sort })
    setNewLabel('')
    load()
  }

  async function updateItem(id, patch) {
    await supabase.from('checklist_items').update(patch).eq('id', id)
    load()
  }

  async function removeItem(id) {
    await supabase.from('checklist_items').delete().eq('id', id)
    load()
  }

  async function move(item, dir) {
    const ordered = [...items].sort((a, b) => a.sort_order - b.sort_order)
    const idx = ordered.findIndex((i) => i.id === item.id)
    const swap = ordered[idx + dir]
    if (!swap) return
    await Promise.all([
      supabase.from('checklist_items').update({ sort_order: swap.sort_order }).eq('id', item.id),
      supabase.from('checklist_items').update({ sort_order: item.sort_order }).eq('id', swap.id),
    ])
    load()
  }

  const completedCount = activeItems.filter((i) => doneToday.has(i.id)).length
  const allDone = activeItems.length > 0 && completedCount === activeItems.length

  if (loading) return <Card><Loading rows={5} /></Card>

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="grid grid-4">
        <Stat label="Current streak" value={`${streak}d`} tone={streak > 0 ? 'pos' : ''}
              sub={streak === 0 ? 'complete today to start one' : 'days in a row'} />
        <Stat label="Best streak" value={`${best}d`} sub="all time" />
        <Stat label="Last 30 days" value={`${last30.complete}/${last30.total}`}
              sub={`${Math.round((last30.complete / last30.total) * 100)}% complete`} />
        <Stat label="Today" value={`${completedCount}/${activeItems.length}`}
              tone={allDone ? 'pos' : ''} sub={allDone ? 'all done ✓' : 'in progress'} />
      </div>

      <Card
        title="Pre-market checklist"
        action={
          <div className="row" style={{ gap: 8 }}>
            <input
              type="date"
              value={date}
              max={todayStr()}
              onChange={(e) => setDate(e.target.value)}
              style={{ width: 150 }}
            />
            <button className="btn-sm" onClick={() => setManage((m) => !m)}>
              {manage ? 'Done' : 'Edit items'}
            </button>
          </div>
        }
      >
        <div className="small muted mb">{longDate(date)}</div>

        {activeItems.length === 0 && !manage ? (
          <Empty icon="✓" title="No checklist items"
                 hint="Add the things you want to do before every session."
                 action={<button className="btn-primary" onClick={() => setManage(true)}>Add items</button>} />
        ) : manage ? (
          <div className="col" style={{ gap: 8 }}>
            {items.map((item) => (
              <div className="row" key={item.id} style={{ gap: 8 }}>
                <input
                  value={item.label}
                  onChange={(e) =>
                    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, label: e.target.value } : i)))
                  }
                  onBlur={(e) => updateItem(item.id, { label: e.target.value.trim() || item.label })}
                />
                <button className="btn-sm btn-ghost" onClick={() => move(item, -1)} title="Move up">↑</button>
                <button className="btn-sm btn-ghost" onClick={() => move(item, 1)} title="Move down">↓</button>
                <button
                  className="btn-sm"
                  onClick={() => updateItem(item.id, { is_active: !item.is_active })}
                  title={item.is_active ? 'Pause this item' : 'Reactivate'}
                >
                  {item.is_active ? 'Active' : 'Paused'}
                </button>
                <DeleteButton onDelete={() => removeItem(item.id)} label="✕" />
              </div>
            ))}
            <form className="row" onSubmit={addItem} style={{ gap: 8, marginTop: 4 }}>
              <input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Add a checklist item…"
              />
              <button className="btn-primary" type="submit" disabled={!newLabel.trim()}>Add</button>
            </form>
          </div>
        ) : (
          <div className="col" style={{ gap: 8 }}>
            {activeItems.map((item) => {
              const done = doneToday.has(item.id)
              return (
                <div
                  key={item.id}
                  className={`checkrow ${done ? 'done' : ''}`}
                  onClick={() => toggle(item)}
                  role="checkbox"
                  aria-checked={done}
                  tabIndex={0}
                  onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && (e.preventDefault(), toggle(item))}
                >
                  <span className="box">✓</span>
                  <span className="lbl grow">{item.label}</span>
                </div>
              )
            })}
            {allDone && (
              <div className="alert ok" style={{ marginTop: 4 }}>
                Checklist complete. You are cleared to trade your plan.
              </div>
            )}
          </div>
        )}
      </Card>

      <Card title="Last 12 weeks">
        <div className="heat">
          {history.map((d) => {
            const bg =
              d.ratio >= 1 ? 'var(--pos)'
              : d.ratio >= 0.66 ? 'rgba(61,220,151,0.6)'
              : d.ratio > 0 ? 'rgba(61,220,151,0.28)'
              : 'var(--panel-2)'
            return (
              <div
                key={d.date}
                className="heat-cell"
                style={{ background: bg }}
                title={`${shortDate(d.date)} · ${Math.round(d.ratio * 100)}%`}
              />
            )
          })}
        </div>
        <div className="row tiny faint" style={{ marginTop: 10, gap: 6 }}>
          <span>Less</span>
          <span className="heat-cell" style={{ background: 'var(--panel-2)' }} />
          <span className="heat-cell" style={{ background: 'rgba(61,220,151,0.28)' }} />
          <span className="heat-cell" style={{ background: 'rgba(61,220,151,0.6)' }} />
          <span className="heat-cell" style={{ background: 'var(--pos)' }} />
          <span>More</span>
        </div>
      </Card>
    </div>
  )
}
