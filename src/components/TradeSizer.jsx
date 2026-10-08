import { CONTRACTS, RESULTS, sizeTrade } from '../lib/contracts'
import { money, usd, num, pnlClass, getDisplayCurrency } from '../lib/format'
import { useAuth } from '../context/AuthContext'
import { Field, Segmented } from './ui'

/**
 * Prices in, dollars out. Give it entry, stop and target as you saw them on
 * the chart; it works out the direction, the point distances and the P&L that
 * lands on the calendar.
 */
export default function TradeSizer({ value, onChange }) {
  const { settings } = useAuth()
  const ccy = settings?.currency || getDisplayCurrency()
  const s = sizeTrade(value)
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value })
  const pick = (k) => (v) => onChange({ ...value, [k]: value[k] === v ? '' : v })

  const pts = (p) => (p ? `${num(p, p % 1 === 0 ? 0 : 2)} pts` : '—')

  return (
    <div className="card sizer">
      <div className="grid grid-2">
        <Field label="Contract">
          <Segmented
            value={value.contract}
            onChange={pick('contract')}
            options={CONTRACTS.map((c) => ({ value: c.id, label: c.name }))}
          />
        </Field>
        <Field label="Contracts">
          <input type="number" step="1" min="0" value={value.qty} onChange={set('qty')} />
        </Field>
      </div>

      {value.contract && (
        <div className="tiny faint" style={{ marginTop: -2 }}>
          1 {value.contract} = {usd(s.perPoint, { decimals: 0 })} per point
          {Number(value.qty) > 1 && (
            <> · {value.qty} contracts = <strong>{usd(s.dollarsPerPoint, { decimals: 0 })} per point</strong></>
          )}
          {ccy !== 'USD' && <> · settles in USD, your account is in {ccy}</>}
        </div>
      )}

      <div className="grid grid-3 mt">
        <Field label="Entry price">
          <input type="number" step="any" value={value.entryPrice}
                 onChange={set('entryPrice')} placeholder="20000" />
        </Field>
        <Field label="Stop loss price">
          <input type="number" step="any" value={value.stopPrice}
                 onChange={set('stopPrice')} placeholder="19980" />
        </Field>
        <Field label="Take profit price">
          <input type="number" step="any" value={value.targetPrice}
                 onChange={set('targetPrice')} placeholder="20060" />
        </Field>
      </div>

      {/* what the prices imply, before any outcome is chosen */}
      {(s.stopPoints > 0 || s.targetPoints > 0) && (
        <div className="row-wrap tiny" style={{ gap: 7, marginTop: 9 }}>
          {s.dir && (
            <span className={`chip dir-${s.dir}`}>
              {s.dir === 'long' ? '↑ Long' : '↓ Short'}
            </span>
          )}
          <span className="chip">Stop {pts(s.stopPoints)}</span>
          <span className="chip">Target {pts(s.targetPoints)}</span>
          {s.rr > 0 && <span className="chip">{num(s.rr)}R</span>}
          <span className="faint">worked out from your prices</span>
        </div>
      )}

      {s.warning && <div className="alert error" style={{ marginTop: 9 }}>{s.warning}</div>}

      <div className="grid grid-2 mt">
        <Field label="How did it finish?">
          <Segmented value={value.result} onChange={pick('result')} options={RESULTS} />
        </Field>
        <Field label="Account balance before">
          <input type="number" step="any" value={value.balance} onChange={set('balance')}
                 placeholder="50000" />
        </Field>
      </div>

      {/* The level you aimed at is a default, never the answer — a fill is
          almost never exactly on it, so this is always askable. */}
      {value.result && (
        <div className="grid grid-2 mt">
          <Field label="Exit price — the fill you actually got">
            <input
              type="number" step="any" value={value.exitPrice} onChange={set('exitPrice')}
              placeholder={s.defaultExit != null ? String(s.defaultExit) : '20015'}
            />
          </Field>
          <Field label="Fees / commissions">
            <input type="number" step="any" value={value.fees} onChange={set('fees')} />
          </Field>
        </div>
      )}

      {ccy !== 'USD' && (
        <div className="grid grid-2 mt">
          <Field label={`USD → ${ccy} rate`}>
            <input type="number" step="any" value={value.fxRate} onChange={set('fxRate')}
                   placeholder="0.7617" />
          </Field>
          <div className="tiny faint" style={{ alignSelf: 'end', paddingBottom: 9 }}>
            {value.contract} pays in dollars, so the figures are converted at this rate.
            {s.converted && (
              <> {usd(1, { decimals: 0 })} = {money(s.fx, { currency: ccy, decimals: 4 })}.</>
            )}
          </div>
        </div>
      )}

      {s.offLevel && (
        <div className="tiny faint" style={{ marginTop: 7 }}>
          Filled at {s.exit} rather than {s.defaultExit} — the P&L below uses your fill.
        </div>
      )}

      <div className="grid grid-2 mt">
        <Field label={`Actual P&L from your broker (${ccy}, optional)`}>
          <input type="number" step="any" value={value.actualPnl}
                 onChange={set('actualPnl')} placeholder={s.plannedPnl ? s.plannedPnl.toFixed(2) : ''} />
        </Field>
        <div className="tiny faint" style={{ alignSelf: 'end', paddingBottom: 9 }}>
          The figures above assume a clean fill at your level. If your statement says
          something different, put the real number here and it is what gets recorded.
        </div>
      </div>

      {/* ---- the maths, live ---- */}
      <div className="sizer-out">
        <div className="sizer-tile">
          <div className="k">Risk</div>
          <div className="v neg">{s.risk ? `−${money(s.risk)}` : '—'}</div>
          <div className="s">
            {s.stopPoints > 0 ? pts(s.stopPoints) : 'needs entry + stop'}
            {s.converted && s.riskUsd > 0 && ` · ${usd(s.riskUsd)}`}
            {s.riskPct > 0 && ` · ${(s.riskPct * 100).toFixed(2)}% of account`}
          </div>
        </div>
        <div className="sizer-tile">
          <div className="k">Reward</div>
          <div className="v pos">{s.reward ? `+${money(s.reward)}` : '—'}</div>
          <div className="s">
            {s.targetPoints > 0 ? pts(s.targetPoints) : 'needs entry + target'}
            {s.converted && s.rewardUsd > 0 && ` · ${usd(s.rewardUsd)}`}
            {s.rr > 0 && ` · ${num(s.rr)}R`}
          </div>
        </div>
        <div className="sizer-tile wide">
          <div className="k">Result {s.hasActual && <span className="faint">· actual</span>}</div>
          <div className={`v big ${pnlClass(s.pnl)}`}>
            {s.complete ? money(s.pnl, { sign: true }) : '—'}
          </div>
          <div className="s">
            {s.complete && s.endBalance != null
              ? <>{money(s.startBalance)} → <strong>{money(s.endBalance)}</strong></>
              : s.complete
                ? <>out at {s.exit} · {pts(s.exitPoints)} · goes on the calendar</>
                : 'goes straight onto the calendar'}
          </div>
          {s.converted && s.complete && (
            <div className="tiny faint" style={{ marginTop: 3 }}>
              {usd(s.pnlUsd, { sign: true })} converted at {num(s.fx, 4)}
            </div>
          )}
          {s.hasActual && Math.abs(s.slip) >= 0.005 && (
            <div className="tiny faint" style={{ marginTop: 4 }}>
              plan said {money(s.plannedPnl, { sign: true })} ·{' '}
              <span className={s.slip < 0 ? 'neg' : 'pos'}>
                {money(s.slip, { sign: true })}
              </span>{' '}
              to slippage &amp; costs
            </div>
          )}
        </div>
      </div>

      {!s.complete && (
        <div className="tiny faint" style={{ marginTop: 9 }}>
          Give it the contract, your entry price and how the trade finished, and the
          points and P&L are worked out from your fills and added to the calendar on
          that date.
        </div>
      )}
    </div>
  )
}
