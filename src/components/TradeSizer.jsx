import { CONTRACTS, RESULTS, sizeTrade } from '../lib/contracts'
import { money, num, pnlClass } from '../lib/format'
import { Field, Segmented } from './ui'

/**
 * Points in, dollars out. Pick the contract, say where the stop and target
 * were, say how it finished, and this works out the P&L that lands on the
 * calendar — plus what it did to the account balance.
 */
export default function TradeSizer({ value, onChange }) {
  const s = sizeTrade(value)
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value })
  const pick = (k) => (v) => onChange({ ...value, [k]: value[k] === v ? '' : v })

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
        <Field label="Direction">
          <Segmented
            value={value.direction}
            onChange={(v) => onChange({ ...value, direction: v })}
            options={[{ value: 'long', label: '↑ Long' }, { value: 'short', label: '↓ Short' }]}
          />
        </Field>
      </div>

      {value.contract && (
        <div className="tiny faint" style={{ marginTop: -4 }}>
          1 {value.contract} = {money(s.perPoint, { decimals: 0 })} per point
          {Number(value.qty) > 1 && <> · {value.qty} contracts = {money(s.perPoint * Number(value.qty), { decimals: 0 })} per point</>}
        </div>
      )}

      <div className="grid grid-3 mt">
        <Field label="Contracts">
          <input type="number" step="1" min="0" value={value.qty} onChange={set('qty')} />
        </Field>
        <Field label="Stop loss (points)">
          <input type="number" step="any" min="0" value={value.stopPoints}
                 onChange={set('stopPoints')} placeholder="e.g. 20" />
        </Field>
        <Field label="Take profit (points)">
          <input type="number" step="any" min="0" value={value.targetPoints}
                 onChange={set('targetPoints')} placeholder="e.g. 60" />
        </Field>
      </div>

      <div className="grid grid-2 mt">
        <Field label="How did it finish?">
          <Segmented value={value.result} onChange={pick('result')} options={RESULTS} />
        </Field>
        <Field label="Account balance before">
          <input type="number" step="any" value={value.balance} onChange={set('balance')}
                 placeholder="50000" />
        </Field>
      </div>

      {value.result === 'manual' && (
        <div className="grid grid-2 mt">
          <Field label="Actual P&L (− for a loss)">
            <input type="number" step="any" value={value.manualPnl} onChange={set('manualPnl')} />
          </Field>
          <Field label="Fees / commissions">
            <input type="number" step="any" value={value.fees} onChange={set('fees')} />
          </Field>
        </div>
      )}
      {value.result && value.result !== 'manual' && (
        <div className="grid grid-2 mt">
          <Field label="Fees / commissions">
            <input type="number" step="any" value={value.fees} onChange={set('fees')} />
          </Field>
          <div />
        </div>
      )}

      {/* ---- the maths, live ---- */}
      <div className="sizer-out">
        <div className="sizer-tile">
          <div className="k">Risk</div>
          <div className="v neg">{s.risk ? `−${money(s.risk)}` : '—'}</div>
          {s.riskPct > 0 && <div className="s">{(s.riskPct * 100).toFixed(2)}% of account</div>}
        </div>
        <div className="sizer-tile">
          <div className="k">Reward</div>
          <div className="v pos">{s.reward ? `+${money(s.reward)}` : '—'}</div>
          {s.rr > 0 && <div className="s">{num(s.rr)}R</div>}
        </div>
        <div className="sizer-tile wide">
          <div className="k">Result</div>
          <div className={`v big ${pnlClass(s.pnl)}`}>
            {s.complete ? money(s.pnl, { sign: true }) : '—'}
          </div>
          <div className="s">
            {s.endBalance != null && s.complete
              ? <>{money(s.startBalance)} → <strong>{money(s.endBalance)}</strong></>
              : 'goes straight onto the calendar'}
          </div>
        </div>
      </div>

      {!s.complete && (
        <div className="tiny faint" style={{ marginTop: 9 }}>
          Pick a contract, the number of contracts and how it finished, and the P&L is
          worked out for you and added to the calendar on that date.
        </div>
      )}
    </div>
  )
}
