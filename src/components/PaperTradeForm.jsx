import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useModels } from '../lib/hooks'
import { sizeTrade, perPoint } from '../lib/contracts'
import { longDate } from '../lib/format'
import { Modal, Field, Alert, DeleteButton } from './ui'
import TradeSizer from './TradeSizer'

const BLANK = {
  contract: '', qty: '1',
  entryPrice: '', stopPrice: '', targetPrice: '', exitPrice: '',
  result: '', fees: '0', balance: '', actualPnl: '', fxRate: '',
}

/** Log one demo trade into a backtest month. Same sizing as a real trade. */
export default function PaperTradeForm({ sessionId, date, trade, onClose, onSaved, onDeleted }) {
  const { user, settings } = useAuth()
  const { models } = useModels()
  const [size, setSize] = useState(BLANK)
  const [modelId, setModelId] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const editing = Boolean(trade?.id)

  useEffect(() => {
    if (!settings) return
    setSize((z) => (z.fxRate ? z : { ...z, fxRate: String(settings.fx_rate ?? 1) }))
  }, [settings])

  useEffect(() => {
    if (!trade?.id) return
    setSize({
      contract: trade.contract || '',
      qty: String(trade.quantity ?? '1'),
      entryPrice: trade.entry_price ?? '',
      stopPrice: trade.stop_price ?? '',
      targetPrice: trade.target_price ?? '',
      exitPrice: trade.exit_price ?? '',
      result: trade.result || '',
      fees: String(trade.fees ?? '0'),
      balance: '',
      actualPnl: '',
      fxRate: String(trade.fx_rate ?? 1),
    })
    setModelId(trade.model_id || '')
    setNote(trade.note || '')
  }, [trade?.id])

  const sized = sizeTrade(size)

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      if (!sized.complete) throw new Error('Pick a contract, a size and how it finished.')
      const n = (v) => (v === '' || v == null ? null : Number(v))
      const payload = {
        user_id: user.id,
        session_id: sessionId,
        model_id: modelId || null,
        trade_date: date,
        contract: size.contract,
        direction: sized.dir || 'long',
        quantity: Number(size.qty) || 1,
        multiplier: perPoint(size.contract),
        entry_price: n(size.entryPrice),
        stop_price: n(size.stopPrice),
        target_price: n(size.targetPrice),
        exit_price: sized.exit,
        stop_points: sized.stopPoints || null,
        target_points: sized.targetPoints || null,
        result: size.result || null,
        fees: Number(size.fees) || 0,
        pnl: Number(sized.pnl.toFixed(2)),
        pnl_usd: Number(sized.pnlUsd.toFixed(2)),
        fx_rate: sized.fx,
        note: note.trim() || null,
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
      title={`${editing ? 'Edit' : 'Demo trade'} · ${longDate(date)}`}
      onClose={onClose}
      wide
      footer={
        <>
          {editing && onDeleted && <DeleteButton onDelete={() => onDeleted(trade)} label="Delete" />}
          <div className="spacer" />
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-go" onClick={save} disabled={busy}>
            {busy ? 'Saving…' : editing ? 'Save changes' : 'Add to the month'}
          </button>
        </>
      }
    >
      <form onSubmit={save} className="col" style={{ gap: 14 }}>
        <Alert kind="error">{error}</Alert>
        <div className="tiny faint">
          Demo money. This never touches your live calendar, goals or equity curve.
        </div>

        {models.length > 0 && (
          <Field label="Model (optional)">
            <select value={modelId} onChange={(e) => setModelId(e.target.value)}>
              <option value="">— none —</option>
              {models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </Field>
        )}

        <TradeSizer value={size} onChange={setSize} />

        <Field label="Note (optional)">
          <input value={note} onChange={(e) => setNote(e.target.value)}
                 placeholder="What the setup was, in a line" />
        </Field>

        <button type="submit" hidden />
      </form>
    </Modal>
  )
}
