import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useModels } from '../lib/hooks'
import { longDate, money } from '../lib/format'
import { syncAttachments, loadAttachments } from '../lib/api'
import { Modal, Field, Alert, DeleteButton, Segmented } from './ui'
import ScreenshotUploader from './Screenshots'

const BLANK = {
  direction: 'long',
  outcome: '',
  amount: '',
  model_id: '',
  execution_notes: '',
  mistakes: '',
  improvements: '',
}

/**
 * A demo trade: which way, how it went, how much, and what you did.
 *
 * No entry, stop or target — backtesting a month is about the decisions,
 * and asking for tick data you are reading off a chart replay turns a
 * thirty-second log into a chore nobody keeps up.
 */
export default function PaperTradeForm({ sessionId, date, trade, onClose, onSaved, onDeleted }) {
  const { user } = useAuth()
  const { models } = useModels()
  const [form, setForm] = useState(BLANK)
  const [paths, setPaths] = useState([])
  // Whether `paths` is the real list yet. Until it is, a save must not take
  // its emptiness as an instruction to detach anything.
  const [chartsLoaded, setChartsLoaded] = useState(!trade?.id)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const editing = Boolean(trade?.id)

  useEffect(() => {
    if (!trade?.id) return
    const pnl = Number(trade.pnl || 0)
    setForm({
      direction: trade.direction || 'long',
      // The row's own outcome, not the sign of its P&L: a day you stood
      // aside is worth 0 and would otherwise reopen with nothing selected.
      outcome: trade.outcome || (pnl > 0 ? 'win' : pnl < 0 ? 'loss' : ''),
      amount: pnl ? String(Math.abs(pnl)) : '',
      model_id: trade.model_id || '',
      execution_notes: trade.execution_notes || '',
      mistakes: trade.mistakes || '',
      improvements: trade.improvements || '',
    })
    loadAttachments('backtest_trade_id', [trade.id])
      .then((files) => {
        setPaths(files[trade.id] || [])
        setChartsLoaded(true)
      })
      .catch((e) => setError(e.message || String(e)))
  }, [trade?.id])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  // a day you passed on: no side, no size, just why
  const stood = form.outcome === 'no_trade'
  // break even: you took it, it came back flat. A side, no amount — the
  // whole point of B/E is that there is no number to type.
  const be = form.outcome === 'breakeven'
  const amount = Math.abs(Number(form.amount) || 0)
  // the sign comes from the result, so the amount is always typed positive
  const pnl = stood || be ? 0 : form.outcome === 'loss' ? -amount : amount
  const ready = stood || be ? true : Boolean(form.outcome) && amount > 0

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      if (!form.outcome) throw new Error('Win, loss, break even, or did you stand aside?')
      if (!stood && !be && !amount) throw new Error('How much did it make or lose?')

      const payload = {
        user_id: user.id,
        session_id: sessionId,
        model_id: form.model_id || null,
        trade_date: date,
        direction: form.direction,
        outcome: form.outcome,
        pnl: Number(pnl.toFixed(2)),
        execution_notes: form.execution_notes.trim() || null,
        mistakes: form.mistakes.trim() || null,
        improvements: form.improvements.trim() || null,
      }

      let rowId = trade?.id
      if (editing) {
        const { error: err } = await supabase
          .from('backtest_trades').update(payload).eq('id', rowId)
        if (err) throw err
      } else {
        const { data, error: err } = await supabase
          .from('backtest_trades').insert(payload).select('id').single()
        if (err) throw err
        rowId = data.id
      }

      await syncAttachments({
        userId: user.id, backtestTradeId: rowId, paths, prune: chartsLoaded,
      })

      onSaved?.()
      onClose()
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={`${editing ? 'Edit demo trade' : 'Demo trade'} · ${longDate(date)}`}
      onClose={onClose}
      footer={
        <>
          {editing && onDeleted && <DeleteButton onDelete={() => onDeleted(trade)} label="Delete" />}
          <div className="spacer" />
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-go" onClick={save} disabled={busy || !ready}>
            {busy ? 'Saving…' : editing ? 'Save changes' : 'Add to the month'}
          </button>
        </>
      }
    >
      <form onSubmit={save} className="col" style={{ gap: 14 }}>
        <Alert kind="error">{error}</Alert>

        <Field label="How did it go?">
          <Segmented
            value={form.outcome}
            onChange={(v) => setForm((f) => ({ ...f, outcome: f.outcome === v ? '' : v }))}
            options={[
              { value: 'win', label: 'Win' },
              { value: 'loss', label: 'Loss' },
              { value: 'breakeven', label: '→ B/E' },
              { value: 'no_trade', label: '⊘ No trade' },
            ]}
          />
        </Field>

        {!stood && (
          <>
            <Field label="Direction">
              <Segmented
                value={form.direction}
                onChange={(v) => setForm((f) => ({ ...f, direction: v }))}
                options={[{ value: 'long', label: '↑ Long' }, { value: 'short', label: '↓ Short' }]}
              />
            </Field>

            {!be && (
              <Field label={form.outcome === 'loss' ? 'How much did it lose?' : 'How much did it make?'}>
                <input
                  type="number" step="any" min="0" value={form.amount} onChange={set('amount')}
                  placeholder="250"
                  style={{ fontSize: 19, fontWeight: 700 }}
                />
              </Field>
            )}
          </>
        )}

        {ready && !stood && (
          <div className="daysum">
            <span className={`big ${be ? '' : form.outcome === 'loss' ? 'neg' : 'pos'}`}>
              {be ? money(0) : money(pnl, { sign: true })}
            </span>
            <span className="muted small">
              {be
                ? `flat on ${longDate(date)} · counts as a trade, never as a win or a loss`
                : `goes on ${longDate(date)} · ${form.direction === 'long' ? 'long' : 'short'}`}
            </span>
          </div>
        )}

        {stood && (
          <div className="daysum stood-sum">
            <span className="big" style={{ color: 'var(--text-2)' }}>⊘ No trade</span>
            <span className="muted small">counts as a day reviewed, never as a win or loss</span>
          </div>
        )}

        {models.length > 0 && (
          <Field label="Model (optional)">
            <select value={form.model_id} onChange={set('model_id')}>
              <option value="">— none —</option>
              {models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </Field>
        )}

        <Field label={stood ? 'The chart you passed on' : 'Chart'}>
          <ScreenshotUploader paths={paths} onChange={setPaths} />
        </Field>

        <Field label={stood ? 'Why did you stand aside?' : 'What did you do?'}>
          <textarea rows={4} value={form.execution_notes} onChange={set('execution_notes')}
                    placeholder={stood
                      ? 'No clean structure, chopping inside the range, nothing your model fires on.'
                      : 'What you saw, why you took it, how you managed it.'} />
        </Field>

        {!stood && <Field label="Mistake (optional)">
          <textarea rows={2} value={form.mistakes} onChange={set('mistakes')}
                    placeholder="What broke the plan?" />
        </Field>}

        {!stood && <Field label="What could you have done better (optional)">
          <textarea rows={2} value={form.improvements} onChange={set('improvements')}
                    placeholder="One concrete change for next time." />
        </Field>}

        <button type="submit" hidden />
      </form>
    </Modal>
  )
}
