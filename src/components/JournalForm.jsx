import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useTags } from '../lib/hooks'
import { syncTags, syncAttachments, loadTagLinks, loadAttachments } from '../lib/api'
import { todayStr } from '../lib/format'
import { Modal, Field, Alert, DeleteButton, Segmented } from './ui'
import TagPicker from './TagPicker'
import ScreenshotUploader from './Screenshots'
import JournalFields from './JournalFields'

const BLANK = {
  title: '',
  entry_date: todayStr(),
  setup: '', reasoning: '', emotions: '', mistakes: '', improvements: '',
  is_shared: true,
  outcome: '',
  trade_id: '',
}

export default function JournalForm({ entry, trades = [], onClose, onSaved, onDeleted }) {
  const { user } = useAuth()
  const { tags, createTag } = useTags()

  const [form, setForm] = useState(BLANK)
  const [tagIds, setTagIds] = useState([])
  const [paths, setPaths] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const editing = Boolean(entry?.id)

  useEffect(() => {
    if (!entry?.id) return
    setForm({
      title: entry.title || '',
      entry_date: entry.entry_date || todayStr(),
      setup: entry.setup || '',
      reasoning: entry.reasoning || '',
      emotions: entry.emotions || '',
      mistakes: entry.mistakes || '',
      improvements: entry.improvements || '',
      is_shared: entry.is_shared,
      outcome: entry.outcome || '',
      trade_id: entry.trade_id || '',
    })
    ;(async () => {
      const [links, files] = await Promise.all([
        loadTagLinks('journal_tags', 'journal_entry_id', [entry.id]),
        loadAttachments('journal_entry_id', [entry.id]),
      ])
      setTagIds(links[entry.id] || [])
      setPaths(files[entry.id] || [])
    })()
  }, [entry?.id])

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const payload = {
        user_id: user.id,
        title: form.title.trim() || `Journal · ${form.entry_date}`,
        entry_date: form.entry_date,
        setup: form.setup || null,
        reasoning: form.reasoning || null,
        emotions: form.emotions || null,
        mistakes: form.mistakes || null,
        improvements: form.improvements || null,
        is_shared: form.is_shared,
        outcome: form.outcome || null,
        trade_id: form.trade_id || null,
      }

      let row
      if (editing) {
        const { data, error } = await supabase
          .from('journal_entries').update(payload).eq('id', entry.id).select().single()
        if (error) throw error
        row = data
      } else {
        const { data, error } = await supabase
          .from('journal_entries').insert(payload).select().single()
        if (error) throw error
        row = data
      }

      await syncTags({ table: 'journal_tags', column: 'journal_entry_id', id: row.id, tagIds })
      await syncAttachments({
        userId: user.id,
        journalEntryId: row.id,
        tradeId: row.trade_id || null,
        paths,
      })

      onSaved?.(row)
      onClose()
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setBusy(false)
    }
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  return (
    <Modal
      title={editing ? 'Edit journal entry' : 'New journal entry'}
      onClose={onClose}
      wide
      footer={
        <>
          {editing && onDeleted && <DeleteButton onDelete={() => onDeleted(entry)} label="Delete entry" />}
          <div className="spacer" />
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={busy}>
            {busy ? 'Saving…' : 'Save entry'}
          </button>
        </>
      }
    >
      <form onSubmit={save} className="col" style={{ gap: 14 }}>
        <Alert kind="error">{error}</Alert>

        <div className="grid grid-2">
          <Field label="Title">
            <input value={form.title} onChange={set('title')} placeholder="Monday review" autoFocus />
          </Field>
          <Field label="Date">
            <input type="date" value={form.entry_date} onChange={set('entry_date')} />
          </Field>
        </div>

        {trades.length > 0 && (
          <Field label="Link to a trade (optional — your P&L is never shared)">
            <select value={form.trade_id} onChange={set('trade_id')}>
              <option value="">— no trade —</option>
              {trades.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.trade_date} · {t.symbol} · {t.direction}
                </option>
              ))}
            </select>
          </Field>
        )}

        <JournalFields value={form} onChange={(v) => setForm((f) => ({ ...f, ...v }))} rows={3} />

        <Field label="Tags">
          <TagPicker tags={tags} value={tagIds} onChange={setTagIds} createTag={createTag} />
        </Field>

        <Field label="Screenshots">
          <ScreenshotUploader paths={paths} onChange={setPaths} />
        </Field>

        <div className="grid grid-2">
          <Field label="How did it go?">
            <Segmented
              value={form.outcome}
              onChange={(v) => setForm((f) => ({ ...f, outcome: f.outcome === v ? '' : v }))}
              options={[
                { value: 'win', label: 'Win' },
                { value: 'loss', label: 'Loss' },
                { value: 'breakeven', label: 'B/E' },
              ]}
            />
          </Field>
          <Field label="Visibility">
            <Segmented
              value={form.is_shared ? 'public' : 'private'}
              onChange={(v) => setForm((f) => ({ ...f, is_shared: v === 'public' }))}
              options={[
                { value: 'public', label: '◉ Public' },
                { value: 'private', label: '🔒 Private' },
              ]}
            />
          </Field>
        </div>
        <div className="tiny faint">
          {form.is_shared
            ? 'Everyone signed in can read this entry — your writing, tags, screenshots and win/loss label. Your P&L, size and prices are never shared.'
            : 'Only you can see this entry.'}
          {' '}You can change this any time, and mark the outcome later.
        </div>

        <button type="submit" hidden />
      </form>
    </Modal>
  )
}
