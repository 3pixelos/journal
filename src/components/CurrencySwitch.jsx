import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { CURRENCIES, money, num } from '../lib/format'
import { Modal, Field, Alert } from './ui'

/**
 * Changing currency has to restate what is already logged, not just swap the
 * symbol — $3,089.64 is not £3,089.64. Every trade keeps its dollar figure,
 * so that is what everything is recomputed from; goals and limits scale by
 * the change in rate because they were set in the old currency.
 */
export default function CurrencySwitch() {
  const { user, settings, setSettings } = useAuth()
  const current = settings?.currency || 'USD'
  const currentRate = Number(settings?.fx_rate ?? 1)

  const [open, setOpen] = useState(false)
  const [ccy, setCcy] = useState(current)
  const [rate, setRate] = useState(String(currentRate))
  const [restate, setRestate] = useState(true)
  const [counts, setCounts] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')

  useEffect(() => {
    setCcy(current)
    setRate(String(currentRate))
  }, [current, currentRate, open])

  // how much is about to be restated
  useEffect(() => {
    if (!open || !user) return
    supabase.from('trades').select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .then(({ count }) => setCounts(count ?? 0))
  }, [open, user])

  const toUsd = ccy === 'USD'
  const nextRate = toUsd ? 1 : Number(rate)
  const valid = Number.isFinite(nextRate) && nextRate > 0
  const changing = ccy !== current || nextRate !== currentRate
  const scale = currentRate > 0 ? nextRate / currentRate : 1

  const sample = settings?.weekly_goal ?? 0

  async function apply() {
    setBusy(true)
    setError('')
    const { error: err } = await supabase.rpc('set_account_currency', {
      new_currency: ccy,
      new_rate: nextRate,
      restate,
    })
    if (err) {
      setBusy(false)
      setError(
        err.message?.includes('set_account_currency')
          ? 'Run migration 012 in Supabase first — the conversion function is missing.'
          : err.message
      )
      return
    }
    const { data } = await supabase.from('settings').select('*').eq('user_id', user.id).single()
    if (data) setSettings(data)
    setBusy(false)
    setOpen(false)
    setDone(`Account is now in ${ccy}.`)
    setTimeout(() => setDone(''), 3000)
  }

  return (
    <>
      <div className="row-wrap" style={{ gap: 12 }}>
        <div>
          <div style={{ fontSize: 21, fontWeight: 780, letterSpacing: '-0.02em' }}>
            {current}
            {current !== 'USD' && (
              <span className="muted" style={{ fontSize: 13, fontWeight: 500 }}>
                {' '}· $1 = {num(currentRate, 4)}
              </span>
            )}
          </div>
          <div className="small muted">
            {current === 'USD'
              ? 'Contracts settle in dollars, so nothing is converted.'
              : `NQ and MNQ settle in dollars and are converted into ${current}.`}
          </div>
        </div>
        <div className="spacer" />
        <button className="btn-sm" onClick={() => setOpen(true)}>Change currency</button>
      </div>

      {done && <div className="alert ok mt">{done}</div>}

      {open && (
        <Modal
          title="Change account currency"
          onClose={() => !busy && setOpen(false)}
          footer={
            <>
              <div className="spacer" />
              <button className="btn-ghost" onClick={() => setOpen(false)} disabled={busy}>
                Cancel
              </button>
              <button className="btn-go" onClick={apply} disabled={busy || !valid || !changing}>
                {busy ? 'Converting…' : restate ? 'Convert everything' : 'Change label only'}
              </button>
            </>
          }
        >
          <Alert kind="error">{error}</Alert>

          <div className="grid grid-2">
            <Field label="Account currency">
              <select value={ccy} onChange={(e) => setCcy(e.target.value)}>
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
                ))}
              </select>
            </Field>
            <Field label={`USD → ${ccy} rate`}>
              <input
                type="number" step="any" value={toUsd ? 1 : rate}
                disabled={toUsd}
                onChange={(e) => setRate(e.target.value)}
                placeholder="0.7617"
              />
            </Field>
          </div>

          {!toUsd && (
            <div className="tiny faint">
              How many {ccy} one US dollar is worth. Sterling sits around 0.76, so
              $100 arrives as about {money(100 * (Number(rate) || 0), { currency: ccy })}.
            </div>
          )}

          <label className="checkrow" onClick={() => setRestate((r) => !r)}
                 role="checkbox" aria-checked={restate} tabIndex={0}>
            <span className="box">✓</span>
            <span className="grow">
              <span className="lbl" style={{ fontWeight: 650 }}>
                Convert everything already logged
              </span>
              <div className="tiny muted" style={{ marginTop: 2 }}>
                {counts == null
                  ? 'Counting your trades…'
                  : `${counts} trade${counts === 1 ? '' : 's'}, your goals, loss limits and
                     account balances are recalculated from their dollar figures.`}
              </div>
            </span>
          </label>

          {changing && (
            <div className={`alert ${restate ? 'info' : 'error'}`}>
              {restate ? (
                <>
                  Your weekly goal of {money(sample)} becomes{' '}
                  <strong>{money(sample * scale, { currency: ccy })}</strong>, and every
                  trade is restated the same way. Trades keep their dollar figures, so
                  this is reversible by switching back.
                </>
              ) : (
                <>
                  Only the symbol changes. A trade recorded as {money(150.5)} would read{' '}
                  {money(150.5, { currency: ccy })} without being converted — leave this
                  on unless your figures were already in {ccy}.
                </>
              )}
            </div>
          )}
        </Modal>
      )}
    </>
  )
}
