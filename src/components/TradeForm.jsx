import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useTags, useAccounts } from '../lib/hooks'
import { computePnl } from '../lib/calc'
import { money, todayStr } from '../lib/format'
import { syncTags, syncAttachments, loadTagLinks, loadAttachments } from '../lib/api'
import { Modal, Field, Alert, DeleteButton } from './ui'
import TagPicker from './TagPicker'
import ScreenshotUploader from './Screenshots'
import JournalFields from './JournalFields'

const BLANK = {
  symbol: '',
  direction: 'long',
  entry_price: '',
  exit_price: '',
  quantity: '1',
  multiplier: '1',
  fees: '0',
  pnl: '',
  trade_date: todayStr(),
  account_id: '',
}

const BLANK_JOURNAL = {
  setup: '', reasoning: '', emotions: '', mistakes: '', improvements: '', is_shared: true,
}

/** Common futures contract multipliers, offered as a shortcut. */
const PRESETS = [
  { label: 'Stocks / Forex', mult: 1 },
  { label: 'MNQ', mult: 2 },
  { label: 'NQ', mult: 20 },
  { label: 'MES', mult: 5 },
  { label: 'ES', mult: 50 },
  { label: 'MGC', mult: 10 },
  { label: 'GC', mult: 100 },
]

export default function TradeForm({ trade, onClose, onSaved, onDeleted }) {
  const { user } = useAuth()
  const { tags, createTag } = useTags()
  const { accounts } = useAccounts()

  const [form, setForm] = useState(BLANK)
  const [tagIds, setTagIds] = useState([])
  const [paths, setPaths] = useState([])
  const [journal, setJournal] = useState(BLANK_JOURNAL)
  const [journalId, setJournalId] = useState(null)
  const [showJournal, setShowJournal] = useState(false)
  const [pnlTouched, setPnlTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const editing = Boolean(trade?.id)

  // ---- hydrate when editing -----------------------------------------
  useEffect(() => {
    if (!trade?.id) return
    setForm({
      symbol: trade.symbol ?? '',
      direction: trade.direction ?? 'long',
      entry_price: trade.entry_price ?? '',
      exit_price: trade.exit_price ?? '',
      quantity: trade.quantity ?? '1',
      multiplier: trade.multiplier ?? '1',
      fees: trade.fees ?? '0',
      pnl: trade.pnl ?? '',
      trade_date: trade.trade_date ?? todayStr(),
      account_id: trade.account_id ?? '',
    })
    setPnlTouched(true)
    ;(async () => {
      const [links, files, { data: j }] = await Promise.all([
        loadTagLinks('trade_tags', 'trade_id', [trade.id]),
        loadAttachments('trade_id', [trade.id]),
        supabase.from('journal_entries').select('*').eq('trade_id', trade.id).maybeSingle(),
      ])
      setTagIds(links[trade.id] || [])
      setPaths(files[trade.id] || [])
      if (j) {
        setJournalId(j.id)
        setJournal({
          setup: j.setup || '', reasoning: j.reasoning || '', emotions: j.emotions || '',
          mistakes: j.mistakes || '', improvements: j.improvements || '', is_shared: j.is_shared,
        })
        setShowJournal(true)
      }
    })()
  }, [trade?.id])

  // ---- auto P&L ------------------------------------------------------
  const autoPnl = computePnl(form)
  useEffect(() => {
    if (pnlTouched) return
    if (autoPnl !== null) setForm((f) => ({ ...f, pnl: autoPnl.toFixed(2) }))
  }, [autoPnl, pnlTouched])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const hasJournalText = Object.entries(journal).some(
    ([k, v]) => k !== 'is_shared' && String(v || '').trim()
  )

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      if (!form.symbol.trim()) throw new Error('Symbol is required.')

      const payload = {
        user_id: user.id,
        symbol: form.symbol.trim().toUpperCase(),
        direction: form.direction,
        entry_price: form.entry_price === '' ? null : Number(form.entry_price),
        exit_price: form.exit_price === '' ? null : Number(form.exit_price),
        quantity: Number(form.quantity) || 0,
        multiplier: Number(form.multiplier) || 1,
        fees: Number(form.fees) || 0,
        pnl: Number(form.pnl) || 0,
        trade_date: form.trade_date,
        account_id: form.account_id || null,
      }

      let row
      if (editing) {
        const { data, error } = await supabase
          .from('trades').update(payload).eq('id', trade.id).select().single()
        if (error) throw error
        row = data
      } else {
        const { data, error } = await supabase.from('trades').insert(payload).select().single()
        if (error) throw error
        row = data
      }

      await syncTags({ table: 'trade_tags', column: 'trade_id', id: row.id, tagIds })

      // Journal entry attached to this trade — created only when written in.
      let jId = journalId
      if (hasJournalText || jId) {
        const jPayload = {
          user_id: user.id,
          trade_id: row.id,
          title: `${row.symbol} · ${row.direction}`,
          entry_date: row.trade_date,
          setup: journal.setup || null,
          reasoning: journal.reasoning || null,
          emotions: journal.emotions || null,
          mistakes: journal.mistakes || null,
          improvements: journal.improvements || null,
          is_shared: journal.is_shared,
        }
        if (jId) {
          await supabase.from('journal_entries').update(jPayload).eq('id', jId)
        } else {
          const { data: created, error: jErr } = await supabase
            .from('journal_entries').insert(jPayload).select().single()
          if (jErr) throw jErr
          jId = created.id
          setJournalId(jId)
        }
        // Screenshots hang off the journal entry so they travel with a shared
        // entry; they stay linked to the trade too for the trade view.
        await syncAttachments({ userId: user.id, tradeId: row.id, journalEntryId: jId, paths })
      } else {
        await syncAttachments({ userId: user.id, tradeId: row.id, paths })
      }

      onSaved?.(row)
      onClose()
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setBusy(false)
    }
  }

  const pnlNum = Number(form.pnl || 0)

  return (
    <Modal
      title={editing ? 'Edit trade' : 'Log a trade'}
      onClose={onClose}
      wide
      footer={
        <>
          {editing && onDeleted && (
            <DeleteButton onDelete={() => onDeleted(trade)} label="Delete trade" />
          )}
          <div className="spacer" />
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={busy}>
            {busy ? 'Saving…' : editing ? 'Save changes' : 'Log trade'}
          </button>
        </>
      }
    >
      <form onSubmit={save} className="col" style={{ gap: 14 }}>
        <Alert kind="error">{error}</Alert>

        <div className="grid grid-3">
          <Field label="Symbol">
            <input
              value={form.symbol}
              onChange={set('symbol')}
              placeholder="MNQ"
              autoFocus
              style={{ textTransform: 'uppercase' }}
            />
          </Field>
          <Field label="Direction">
            <select value={form.direction} onChange={set('direction')}>
              <option value="long">Long</option>
              <option value="short">Short</option>
            </select>
          </Field>
          <Field label="Date">
            <input type="date" value={form.trade_date} onChange={set('trade_date')} />
          </Field>
        </div>

        <div className="grid grid-3">
          <Field label="Entry price">
            <input type="number" step="any" value={form.entry_price} onChange={set('entry_price')} />
          </Field>
          <Field label="Exit price">
            <input type="number" step="any" value={form.exit_price} onChange={set('exit_price')} />
          </Field>
          <Field label="Quantity / contracts">
            <input type="number" step="any" value={form.quantity} onChange={set('quantity')} />
          </Field>
        </div>

        <div className="grid grid-3">
          <Field label="Multiplier">
            <input type="number" step="any" value={form.multiplier} onChange={set('multiplier')} />
          </Field>
          <Field label="Fees / commissions">
            <input type="number" step="any" value={form.fees} onChange={set('fees')} />
          </Field>
          <Field label="Account">
            <select value={form.account_id} onChange={set('account_id')}>
              <option value="">— none —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="row-wrap tiny" style={{ gap: 6 }}>
          <span className="faint">Multiplier presets:</span>
          {PRESETS.map((p) => (
            <span
              key={p.label}
              className={`chip chip-btn ${Number(form.multiplier) === p.mult ? 'on' : ''}`}
              onClick={() => setForm((f) => ({ ...f, multiplier: String(p.mult) }))}
            >
              {p.label}
            </span>
          ))}
        </div>

        <div className="card" style={{ background: 'var(--bg-soft)' }}>
          <div className="row">
            <Field label="Net P&L">
              <input
                type="number"
                step="any"
                value={form.pnl}
                onChange={(e) => { setPnlTouched(true); set('pnl')(e) }}
                style={{ fontSize: 17, fontWeight: 600 }}
              />
            </Field>
            <div style={{ paddingTop: 18, minWidth: 150 }}>
              <div className={`mono ${pnlNum > 0 ? 'pos' : pnlNum < 0 ? 'neg' : 'flat'}`}
                   style={{ fontSize: 20, fontWeight: 650 }}>
                {money(pnlNum, { sign: true })}
              </div>
              {autoPnl !== null && Math.abs(autoPnl - pnlNum) > 0.005 && (
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  onClick={() => { setPnlTouched(false); setForm((f) => ({ ...f, pnl: autoPnl.toFixed(2) })) }}
                >
                  Use calculated {money(autoPnl, { sign: true })}
                </button>
              )}
            </div>
          </div>
          <div className="tiny faint" style={{ marginTop: 6 }}>
            Auto-calculated from prices × quantity × multiplier − fees. Override it for
            partial fills or broker-reported totals.
          </div>
        </div>

        <Field label="Tags">
          <TagPicker tags={tags} value={tagIds} onChange={setTagIds} createTag={createTag} />
        </Field>

        <Field label="Chart screenshots">
          <ScreenshotUploader paths={paths} onChange={setPaths} />
        </Field>

        <div>
          <button
            type="button"
            className="btn-ghost btn-sm"
            onClick={() => setShowJournal((s) => !s)}
            style={{ paddingLeft: 0 }}
          >
            {showJournal ? '▾' : '▸'} Journal entry {journalId ? '(saved)' : '(optional)'}
          </button>
        </div>

        {showJournal && (
          <div className="col" style={{ gap: 12 }}>
            <JournalFields value={journal} onChange={setJournal} />
            <label className="row small" style={{ gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={journal.is_shared}
                onChange={(e) => setJournal((j) => ({ ...j, is_shared: e.target.checked }))}
              />
              Share this entry in the team journal
              <span className="faint">— narrative and screenshots only, never your P&L</span>
            </label>
          </div>
        )}

        <button type="submit" hidden />
      </form>
    </Modal>
  )
}
