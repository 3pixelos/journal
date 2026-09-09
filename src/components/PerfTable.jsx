import { money, num, pnlClass } from '../lib/format'
import { Empty } from './ui'

/**
 * Ranked performance rows with a bar showing relative size of the net figure.
 * Used for the by-tag breakdown — which setups actually pay.
 */
export default function PerfTable({ rows, emptyTitle = 'Nothing to show yet', emptyHint }) {
  if (!rows.length) return <Empty icon="◇" title={emptyTitle} hint={emptyHint} />
  const max = Math.max(...rows.map((r) => Math.abs(r.net)), 1)

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th></th>
            <th className="right">Trades</th>
            <th className="right">Win %</th>
            <th className="right">PF</th>
            <th className="right">Net</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td style={{ minWidth: 120 }}>
                <div className="row" style={{ gap: 6 }}>
                  {r.color && <i className="tag-dot" style={{ background: r.color }} />}
                  <span style={{ fontWeight: 650 }}>{r.label}</span>
                  {r.kind && <span className="tiny faint">{r.kind}</span>}
                </div>
                <div className="bar" style={{ marginTop: 5, height: 4 }}>
                  <span
                    style={{
                      width: `${(Math.abs(r.net) / max) * 100}%`,
                      background: r.net >= 0 ? 'var(--pos)' : 'var(--neg)',
                    }}
                  />
                </div>
              </td>
              <td className="right mono small">{r.count}</td>
              <td className="right mono small">{(r.winRate * 100).toFixed(0)}%</td>
              <td className="right mono small">
                {r.profitFactor === Infinity ? '∞' : num(r.profitFactor)}
              </td>
              <td className={`right mono nowrap ${pnlClass(r.net)}`} style={{ fontWeight: 700 }}>
                {money(r.net, { sign: true })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
