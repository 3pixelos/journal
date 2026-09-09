import { money, pnlClass, longDate, num } from '../lib/format'
import { stats } from '../lib/calc'
import { Modal, Empty } from './ui'

/** A day's trades in a popup, from the calendar or the dashboard week strip. */
export default function DayModal({ date, trades, onClose, onPick, onLog, tags = [], tagLinks = {} }) {
  const s = stats(trades)

  return (
    <Modal
      title={longDate(date)}
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn-go" onClick={onLog}>＋ Log a trade on this day</button>
          <div className="spacer" />
          <button className="btn-ghost" onClick={onClose}>Close</button>
        </>
      }
    >
      {trades.length === 0 ? (
        <Empty icon="○" title="Nothing logged on this day"
               hint="Quiet days count too — but if you traded, get it on the record." />
      ) : (
        <>
          <div className="daysum">
            <span className={`big ${pnlClass(s.net)}`}>{money(s.net, { sign: true })}</span>
            <span className="muted small">
              {s.count} trade{s.count === 1 ? '' : 's'} · {s.wins}W · {s.losses}L
              {s.count > 1 && ` · ${(s.winRate * 100).toFixed(0)}% win rate`}
            </span>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Symbol</th><th>Dir</th>
                  <th className="right">Entry</th><th className="right">Exit</th>
                  <th className="right">Qty</th><th className="right">P&L</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((t) => (
                  <tr key={t.id} className="clickable" onClick={() => onPick(t)}>
                    <td style={{ fontWeight: 700 }}>{t.symbol}</td>
                    <td>
                      <span className={`chip dir-${t.direction}`}>
                        {t.direction === 'long' ? '↑ Long' : '↓ Short'}
                      </span>
                    </td>
                    <td className="right mono small">{t.entry_price ?? '—'}</td>
                    <td className="right mono small">{t.exit_price ?? '—'}</td>
                    <td className="right mono small">{num(t.quantity, 0)}</td>
                    <td className={`right mono ${pnlClass(t.pnl)}`} style={{ fontWeight: 700 }}>
                      {money(t.pnl, { sign: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="tiny faint">Click a trade to edit it.</div>
        </>
      )}
    </Modal>
  )
}
