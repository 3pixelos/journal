import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useTitle } from '../lib/hooks'
import { Card, Empty, Loading, Field, Alert, DeleteButton, Modal } from '../components/ui'

const BLANK = { text: '', note: '' }

export default function Reminders() {
  useTitle('Reminders')
  const { user } = useAuth()

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data } = await supabase
      .from('reminders')
      .select('*')
      .eq('user_id', user.id)
      .order('sort_order')
      .order('created_at')
    setItems(data || [])
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  function open(item) {
    setEditing(item || null)
    setForm(item ? { text: item.text, note: item.note || '' } : BLANK)
    setError('')
    setShowForm(true)
  }

  async function save(e) {
    e.preventDefault()
    if (!form.text.trim()) return setError('Write the rule first.')
    setBusy(true)
    setError('')
    const payload = {
      user_id: user.id,
      text: form.text.trim(),
      note: form.note.trim() || null,
    }
    const { error: err } = editing
      ? await supabase.from('reminders').update(payload).eq('id', editing.id)
      : await supabase.from('reminders').insert({
          ...payload,
          sort_order: Math.max(0, ...items.map((i) => i.sort_order)) + 1,
        })
    setBusy(false)
    if (err) return setError(err.message)
    setShowForm(false)
    load()
  }

  async function toggle(item) {
    await supabase.from('reminders').update({ is_active: !item.is_active }).eq('id', item.id)
    load()
  }

  async function remove(id) {
    await supabase.from('reminders').delete().eq('id', id)
    setShowForm(false)
    load()
  }

  async function move(item, dir) {
    const ordered = [...items].sort((a, b) => a.sort_order - b.sort_order)
    const idx = ordered.findIndex((i) => i.id === item.id)
    const swap = ordered[idx + dir]
    if (!swap) return
    await Promise.all([
      supabase.from('reminders').update({ sort_order: swap.sort_order }).eq('id', item.id),
      supabase.from('reminders').update({ sort_order: item.sort_order }).eq('id', swap.id),
    ])
    load()
  }

  const active = items.filter((i) => i.is_active)

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="row-wrap">
        <div>
          <h2>My trading rules</h2>
          <div className="small muted">
            The things you tell yourself before the market talks you out of them.
            Active rules show on your dashboard every day.
          </div>
        </div>
        <div className="spacer" />
        <button className="btn-primary" onClick={() => open(null)}>＋ Add rule</button>
      </div>

      <Card>
        {loading ? (
          <Loading rows={4} />
        ) : items.length === 0 ? (
          <Empty
            icon="◆"
            title="No rules yet"
            hint='Start with the one you break most. "No more than 2 trades per day" is a good first rule.'
            action={<button className="btn-primary" onClick={() => open(null)}>＋ Add your first rule</button>}
          />
        ) : (
          <div className="col" style={{ gap: 8 }}>
            {items.map((item, i) => (
              <div className={`reminder ${item.is_active ? '' : 'paused'}`} key={item.id}>
                <span className="rnum">{i + 1}</span>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="rtext">{item.text}</div>
                  {item.note && <div className="rnote">{item.note}</div>}
                </div>
                <div className="row" style={{ gap: 4 }}>
                  <button className="btn-sm btn-ghost" onClick={() => move(item, -1)} title="Move up">↑</button>
                  <button className="btn-sm btn-ghost" onClick={() => move(item, 1)} title="Move down">↓</button>
                  <button className="btn-sm" onClick={() => toggle(item)}
                          title={item.is_active ? 'Hide from dashboard' : 'Show on dashboard'}>
                    {item.is_active ? 'Active' : 'Paused'}
                  </button>
                  <button className="btn-sm btn-ghost" onClick={() => open(item)}>Edit</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {items.length > 0 && (
        <div className="small muted">
          {active.length} of {items.length} rule{items.length === 1 ? '' : 's'} active.
          Paused rules stay here but drop off the dashboard.
        </div>
      )}

      {showForm && (
        <Modal
          title={editing ? 'Edit rule' : 'New rule'}
          onClose={() => setShowForm(false)}
          footer={
            <>
              {editing && <DeleteButton onDelete={() => remove(editing.id)} label="Delete rule" />}
              <div className="spacer" />
              <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn-primary" onClick={save} disabled={busy}>
                {busy ? 'Saving…' : 'Save rule'}
              </button>
            </>
          }
        >
          <form className="col" onSubmit={save} style={{ gap: 14 }}>
            <Alert kind="error">{error}</Alert>
            <Field label="The rule">
              <input
                value={form.text}
                autoFocus
                placeholder="No more than 2 trades per day"
                onChange={(e) => setForm({ ...form, text: e.target.value })}
              />
            </Field>
            <Field label="Why (optional)">
              <textarea
                rows={2}
                value={form.note}
                placeholder="Overtrading is how good days turn red."
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />
            </Field>
            <button type="submit" hidden />
          </form>
        </Modal>
      )}
    </div>
  )
}
