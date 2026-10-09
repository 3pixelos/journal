import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useTags, useModels } from '../lib/hooks'
import { syncTags, syncAttachments, loadTagLinks, loadAttachments } from '../lib/api'
import { todayStr } from '../lib/format'
import { sizeTrade, EXECUTIONS, perPoint } from '../lib/contracts'
import { Modal, Field, Alert, DeleteButton, Segmented } from './ui'
import TagPicker from './TagPicker'
import ScreenshotUploader from './Screenshots'
import JournalFields from './JournalFields'
import ModelPicker from './ModelPicker'
import TradeSizer from './TradeSizer'

const BLANK = {
  title: '',
  entry_date: todayStr(),
  setup: '', reasoning: '', emotions: '', mistakes: '', improvements: '',
  execution: '', execution_notes: '',
  is_shared: true,
  outcome: '', fault: '',
  model_id: '',
  trade_id: '',
}

const BLANK_SIZE = {
  contract: '', qty: '1',
  entryPrice: '', stopPrice: '', targetPrice: '', exitPrice: '',
  result: '', fees: '0', balance: '', actualPnl: '', fxRate: '',
}

function Section({ n, title, hint, children }) {
  return (
    <section className="jsec">
      <div className="jsec-head">
        <span className="jsec-n">{n}</span>
        <div>
          <h3>{title}</h3>
          {hint && <div className="tiny faint">{hint}</div>}
        </div>
      </div>
      <div className="col" style={{ gap: 13 }}>{children}</div>
    </section>
  )
}

export default function JournalForm({
  entry, trades = [], kind = 'journal', onClose, onSaved, onDeleted,
}) {
  const { user, settings } = useAuth()
  const { tags, createTag } = useTags()
  const { models, createModel } = useModels()

  const [form, setForm] = useState(BLANK)
  const [size, setSize] = useState(BLANK_SIZE)

  // A new entry starts on the account's saved rate; an existing one keeps
  // whatever rate it was booked at.
  useEffect(() => {
    if (entry?.id || !settings) return
    setSize((z) => (z.fxRate ? z : { ...z, fxRate: String(settings.fx_rate ?? 1) }))
  }, [entry?.id, settings])
  const [checked, setChecked] = useState([])
  const [tagIds, setTagIds] = useState([])
  const [paths, setPaths] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const editing = Boolean(entry?.id)
  // A backtest is the same record without the money: no contract, no prices,
  // no P&L, so nothing to put on the calendar.
  const isBacktest = (entry?.kind || kind) === 'backtest'

  // ---- hydrate an existing entry, and the trade behind it -------------
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
      execution: entry.execution || '',
      execution_notes: entry.execution_notes || '',
      is_shared: entry.is_shared,
      outcome: entry.outcome || '',
      fault: entry.fault || '',
      model_id: entry.model_id || '',
      trade_id: entry.trade_id || '',
    })
    ;(async () => {
      const [links, files, { data: checks }] = await Promise.all([
        loadTagLinks('journal_tags', 'journal_entry_id', [entry.id]),
        loadAttachments('journal_entry_id', [entry.id]),
        supabase.from('journal_checks').select('check_id').eq('journal_entry_id', entry.id),
      ])
      setTagIds(links[entry.id] || [])
      setPaths(files[entry.id] || [])
      setChecked((checks || []).map((c) => c.check_id))

      if (entry.trade_id) {
        const { data: t } = await supabase
          .from('trades').select('*').eq('id', entry.trade_id).maybeSingle()
        if (t) {
          const hydrated = {
            contract: t.contract || '',
            qty: String(t.quantity ?? '1'),
            entryPrice: t.entry_price ?? '',
            stopPrice: t.stop_price ?? '',
            targetPrice: t.target_price ?? '',
            exitPrice: t.result === 'manual' ? (t.exit_price ?? '') : '',
            result: t.result || '',
            fees: String(t.fees ?? '0'),
            balance: t.account_balance ?? '',
            actualPnl: '',
            fxRate: String(t.fx_rate ?? 1),
          }
          // The stored P&L is the truth. If it does not match what the levels
          // imply, it was overridden — put it back in the override box so
          // editing round-trips instead of silently reverting to theory.
          const planned = sizeTrade(hydrated).plannedPnl
          if (t.pnl != null && Math.abs(Number(t.pnl) - planned) >= 0.005) {
            hydrated.actualPnl = String(t.pnl)
          }
          setSize(hydrated)
        }
      }
    })()
  }, [entry?.id])

  const model = models.find((m) => m.id === form.model_id) || null
  const sized = sizeTrade(size)

  // Outcome follows the result unless it was set by hand.
  useEffect(() => {
    if (!size.result || form.outcome) return
    const o = size.result === 'target' ? 'win'
      : size.result === 'stop' ? 'loss'
      : sized.pnl > 0 ? 'win'
      : sized.pnl < 0 ? 'loss' : ''
    if (o) setForm((f) => (f.outcome ? f : { ...f, outcome: o }))
  }, [size.result, sized.pnl]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleCheck = (id) =>
    setChecked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      // --- 1. the trade, so the P&L reaches the calendar ---------------
      let tradeId = form.trade_id || null
      if (!isBacktest && sized.complete) {
        const numOrNull = (v) => (v === '' || v == null ? null : Number(v))
        const tradePayload = {
          user_id: user.id,
          symbol: size.contract,
          contract: size.contract,
          direction: sized.dir || 'long',
          quantity: Number(size.qty) || 1,
          multiplier: perPoint(size.contract),
          entry_price: numOrNull(size.entryPrice),
          exit_price: sized.exit,
          stop_price: numOrNull(size.stopPrice),
          target_price: numOrNull(size.targetPrice),
          // distances are derived, but stored so analytics never has to
          // re-derive them from prices
          stop_points: sized.stopPoints || null,
          target_points: sized.targetPoints || null,
          result: size.result,
          fees: Number(size.fees) || 0,
          // pnl is account currency — goals, limits and the calendar are all
          // measured in it; pnl_usd keeps the contract figure alongside
          pnl: Number(sized.pnl.toFixed(2)),
          pnl_usd: Number(sized.pnlUsd.toFixed(2)),
          fx_rate: sized.fx,
          account_balance: numOrNull(size.balance),
          trade_date: form.entry_date,
        }
        if (tradeId) {
          const { error: e1 } = await supabase.from('trades').update(tradePayload).eq('id', tradeId)
          if (e1) throw e1
        } else {
          const { data, error: e1 } = await supabase
            .from('trades').insert(tradePayload).select('id').single()
          if (e1) throw e1
          tradeId = data.id
        }
      }

      // --- 2. the entry ------------------------------------------------
      const payload = {
        user_id: user.id,
        kind: isBacktest ? 'backtest' : 'journal',
        title: form.title.trim() || (size.contract
          ? `${size.contract} · ${model?.name || form.entry_date}`
          : isBacktest ? `${model?.name || 'Backtest'} · ${form.entry_date}`
          : `Journal · ${form.entry_date}`),
        entry_date: form.entry_date,
        setup: form.setup || null,
        reasoning: form.reasoning || null,
        emotions: form.emotions || null,
        mistakes: form.mistakes || null,
        improvements: form.improvements || null,
        execution: form.execution || null,
        execution_notes: form.execution_notes || null,
        is_shared: form.is_shared,
        outcome: form.outcome || null,
        // only meaningful on a loss
        fault: form.outcome === 'loss' ? (form.fault || null) : null,
        model_id: form.model_id || null,
        trade_id: isBacktest ? null : tradeId,
      }

      let row
      if (editing) {
        const { data, error: e2 } = await supabase
          .from('journal_entries').update(payload).eq('id', entry.id).select().single()
        if (e2) throw e2
        row = data
      } else {
        const { data, error: e2 } = await supabase
          .from('journal_entries').insert(payload).select().single()
        if (e2) throw e2
        row = data
      }

      // --- 3. tags, steps, screenshots ---------------------------------
      await syncTags({ table: 'journal_tags', column: 'journal_entry_id', id: row.id, tagIds })

      const wanted = model ? checked.filter((id) => model.checks.some((c) => c.id === id)) : []
      await supabase.from('journal_checks').delete().eq('journal_entry_id', row.id)
      if (wanted.length) {
        await supabase.from('journal_checks')
          .insert(wanted.map((check_id) => ({ journal_entry_id: row.id, check_id })))
      }

      await syncAttachments({
        userId: user.id, journalEntryId: row.id, tradeId: row.trade_id || null, paths,
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
  const linkable = trades.filter((t) => t.id !== form.trade_id)

  return (
    <Modal
      title={`${editing ? 'Edit' : 'New'} ${isBacktest ? 'backtest' : 'journal entry'}`}
      onClose={onClose}
      wide
      footer={
        <>
          {editing && onDeleted && <DeleteButton onDelete={() => onDeleted(entry)} label="Delete entry" />}
          <div className="spacer" />
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-go" onClick={save} disabled={busy}>
            {busy ? 'Saving…'
              : isBacktest ? 'Save backtest'
              : sized.complete ? 'Save & add to calendar'
              : 'Save entry'}
          </button>
        </>
      }
    >
      <form onSubmit={save} className="col" style={{ gap: 4 }}>
        <Alert kind="error">{error}</Alert>

        <div className="grid grid-2">
          <Field label="Title">
            <input value={form.title} onChange={set('title')}
                   placeholder={isBacktest
                     ? (model?.name ? `${model.name} — test` : 'Backtest')
                     : size.contract ? `${size.contract} · ${model?.name || 'session'}` : 'Monday review'} />
          </Field>
          <Field label="Date">
            <input type="date" value={form.entry_date} onChange={set('entry_date')} />
          </Field>
        </div>

        <Section n="1" title="Which model?"
                 hint="The setup you were trading, and the steps it takes.">
          <ModelPicker
            models={models}
            modelId={form.model_id}
            onPickModel={(id) => { setForm((f) => ({ ...f, model_id: id })); setChecked([]) }}
            checked={checked}
            onToggleCheck={toggleCheck}
            createModel={createModel}
          />
        </Section>

        {!isBacktest && (
          <Section n="2" title="The trade"
                   hint="Enter the prices you saw — the points and dollars are worked out for you.">
            <TradeSizer value={size} onChange={setSize} />
            {!sized.complete && linkable.length > 0 && (
              <Field label="…or link an existing trade instead">
                <select value={form.trade_id} onChange={set('trade_id')}>
                  <option value="">— none —</option>
                  {linkable.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.trade_date} · {t.symbol} · {t.direction}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </Section>
        )}

        <Section n={isBacktest ? '2' : '3'} title="Did you follow your strategy?"
                 hint={isBacktest
                   ? 'Did the setup play out the way the model says it should?'
                   : 'Be honest here — this is the number that actually changes your trading.'}>
          <div className="exec-grid">
            {EXECUTIONS.map((x) => (
              <button
                type="button"
                key={x.value}
                className={`exec ${form.execution === x.value ? `on ${x.tone}` : ''}`}
                onClick={() =>
                  setForm((f) => ({ ...f, execution: f.execution === x.value ? '' : x.value }))
                }
              >
                <span className="exec-l">{x.label}</span>
                <span className="exec-h">{x.hint}</span>
              </button>
            ))}
          </div>
        </Section>

        <Section n={isBacktest ? '3' : '4'} title="What did you actually do?"
                 hint="The full play-by-play, start to finish. Write it while it's fresh.">
          <textarea
            rows={6}
            value={form.execution_notes}
            onChange={set('execution_notes')}
            placeholder={
              'Walk through it: what you saw, when you entered, what you were thinking as it '
              + 'moved, whether you moved the stop, how you got out, and why.'
            }
          />
        </Section>

        <Section n={isBacktest ? '4' : '5'} title="The notes" hint="Optional, but this is where the pattern shows up.">
          <JournalFields
            value={form}
            onChange={(v) => setForm((f) => ({ ...f, ...v }))}
            rows={2}
            // nothing was risked, so there is no mental state, no mistake and
            // nothing to do differently — only what the setup was and why
            omit={isBacktest ? ['emotions', 'mistakes', 'improvements'] : []}
          />
          <Field label="Tags">
            <TagPicker tags={tags} value={tagIds} onChange={setTagIds} createTag={createTag} />
          </Field>
        </Section>

        <Section n={isBacktest ? '5' : '6'} title="Charts" hint="Entry, exit, whatever you want to look back at.">
          <ScreenshotUploader paths={paths} onChange={setPaths} />
        </Section>

        <Section n={isBacktest ? '6' : '7'} title="Outcome & visibility">
          <div className="grid grid-2">
            <Field label="How did it go?">
              <Segmented
                value={form.outcome}
                onChange={(v) => setForm((f) => ({ ...f, outcome: f.outcome === v ? '' : v }))}
                options={isBacktest
                  // a test either worked or it did not
                  ? [{ value: 'win', label: 'Win' }, { value: 'loss', label: 'Loss' }]
                  : [
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
          {form.outcome === 'loss' && (
            <div className="fault">
              <div className="tiny faint" style={{ fontWeight: 700, letterSpacing: '0.07em', marginBottom: 8 }}>
                WHOSE FAULT WAS IT?
              </div>
              <div className="fault-grid">
                <button
                  type="button"
                  className={`exec ${form.fault === 'strategy' ? 'on neg' : ''}`}
                  onClick={() => setForm((f) => ({ ...f, fault: f.fault === 'strategy' ? '' : 'strategy' }))}
                >
                  <span className="exec-l">The strategy</span>
                  <span className="exec-h">
                    Setup played out properly and still lost. Counts against the model.
                  </span>
                </button>
                <button
                  type="button"
                  className={`exec ${form.fault === 'mine' ? 'on warn' : ''}`}
                  onClick={() => setForm((f) => ({ ...f, fault: f.fault === 'mine' ? '' : 'mine' }))}
                >
                  <span className="exec-l">Me</span>
                  <span className="exec-h">
                    Entered early, sized wrong, moved the stop. Left out of the model's
                    win rate — it counts against you instead.
                  </span>
                </button>
              </div>
            </div>
          )}

          <div className="tiny faint">
            {form.is_shared
              ? (isBacktest
                  ? 'Everyone signed in can read this backtest — the model, steps, writing, charts and result.'
                  : 'Everyone signed in can read the writing, model, steps, tags, charts and win/loss label. Your P&L, size, balance and prices stay yours.')
              : 'Only you can see this entry.'}
          </div>
        </Section>

        <button type="submit" hidden />
      </form>
    </Modal>
  )
}
