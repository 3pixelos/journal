import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useModels } from '../lib/hooks'
import { longDate, money } from '../lib/format'
import { Modal, Field, Alert, DeleteButton, Segmented } from './ui'

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
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const editing = Boolean(trade?.id)

  useEffect(() => {
    if (!trade?.id) return
    const pnl = Number(trade.pnl || 0)
    setForm({
      direction: trade.direction || 'long',
      outcome: pnl > 0 ? 'win' : pnl < 0 ? 'loss' : '',
      amount: pnl ? String(Math.abs(pnl)) : '',
      model_id: trade.model_id || '',
      execution_notes: trade.execution_notes || '',
      mistakes: trade.mistakes || '',
      improvements: trade.improvements || '',
    })
  }, [trade?.id])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  // a day you passed on: no side, no size, just why
  const stood = form.outcome === 'no_trade'
  const amount = Math.abs(Number(form.amount) || 0)
  // the sign comes from the result, so the amount is always typed positive
  const pnl = stood ? 0 : form.outcome === 'loss' ? -amount : amount
  const ready = stood ? true : Boolean(form.outcome) && amount > 0

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      if (!form.outcome) throw new Error('Win, loss, or did you stand aside?')
      if (!stood && !amount) throw new Error('How much did it make or lose?')

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

      const { error: err } = editing
        ? await supabase.from('backtest_trades').update(payload).eq('id', trade.id)
        : await supabase.from('backtest_trades').insert(payload)
      if (err) throw err

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

            <Field label={form.outcome === 'loss' ? 'How much did it lose?' : 'How much did it make?'}>
              <input
                type="number" step="any" min="0" value={form.amount} onChange={set('amount')}
                placeholder="250"
                style={{ fontSize: 19, fontWeight: 700 }}
              />
            </Field>
          </>
        )}

        {ready && !stood && (
          <div className="daysum">
            <span className={`big ${form.outcome === 'loss' ? 'neg' : 'pos'}`}>
              {money(pnl, { sign: true })}
            </span>
            <span className="muted small">
              goes on {longDate(date)} · {form.direction === 'long' ? 'long' : 'short'}
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
