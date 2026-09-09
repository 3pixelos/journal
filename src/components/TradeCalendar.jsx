import { useMemo } from 'react'
import { money, parseDateStr, toDateStr, todayStr, addDays } from '../lib/format'
import { byDay } from '../lib/calc'

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** Compact money for a calendar cell: +$1.2k / -$340 */
function cell(n) {
  const v = Number(n || 0)
  const abs = Math.abs(v)
  const s = abs >= 1000 ? `$${(abs / 1000).toFixed(abs >= 10000 ? 0 : 1)}k` : `$${Math.round(abs)}`
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${s}`
}

/**
 * Month grid of daily P&L. Green days are winners, red are losers.
 * `month` is a 'YYYY-MM' string.
 */
export default function TradeCalendar({ trades, month, onSelectDay, selectedDay }) {
  const today = todayStr()

  const days = useMemo(() => {
    const map = Object.fromEntries(byDay(trades).map((d) => [d.date, d]))
    const [y, m] = month.split('-').map(Number)
    const first = new Date(y, m - 1, 1)
    const lead = (first.getDay() + 6) % 7 // Monday-based offset
    const gridStart = addDays(toDateStr(first), -lead)

    return Array.from({ length: 42 }, (_, i) => {
      const date = addDays(gridStart, i)
      const d = map[date]
      return {
        date,
        inMonth: date.slice(0, 7) === month,
        pnl: d?.pnl ?? 0,
        count: d?.trades ?? 0,
        dayNum: parseDateStr(date).getDate(),
      }
    })
  }, [trades, month])

  // trim a trailing all-blank week
  const weeks = useMemo(() => {
    const out = []
    for (let i = 0; i < days.length; i += 7) out.push(days.slice(i, i + 7))
    while (out.length > 4 && out[out.length - 1].every((d) => !d.inMonth)) out.pop()
    return out
  }, [days])

  return (
    <>
      <div className="cal-head">
        {DOW.map((d) => <span key={d}>{d}</span>)}
      </div>

      {weeks.map((week, wi) => {
        const wkPnl = week.reduce((a, d) => a + (d.inMonth ? d.pnl : 0), 0)
        const wkTrades = week.reduce((a, d) => a + (d.inMonth ? d.count : 0), 0)
        return (
          <div key={wi}>
            <div className="cal-grid" style={{ marginBottom: 6 }}>
              {week.map((d) => {
                const has = d.count > 0
                const klass = [
                  'cal-cell',
                  d.inMonth ? '' : 'muted-day',
                  has && d.pnl > 0 ? 'win' : '',
                  has && d.pnl < 0 ? 'loss' : '',
                  d.date === today ? 'today' : '',
                ].filter(Boolean).join(' ')

                return (
                  <button
                    key={d.date}
                    className={klass}
                    onClick={() => onSelectDay(d.date === selectedDay ? null : d.date)}
                    title={has ? `${d.date} · ${money(d.pnl, { sign: true })} · ${d.count} trades` : d.date}
                  >
                    <span className="daynum">
                      {d.dayNum}
                      {d.date === selectedDay && <i className="tag-dot" style={{ background: 'var(--accent)' }} />}
                    </span>
                    {has && (
                      <>
                        <span className={`cal-pnl ${d.pnl > 0 ? 'pos' : d.pnl < 0 ? 'neg' : 'flat'}`}>
                          {cell(d.pnl)}
                        </span>
                        <span className="cal-meta">{d.count} trade{d.count === 1 ? '' : 's'}</span>
                      </>
                    )}
                  </button>
                )
              })}
            </div>
            {wkTrades > 0 && (
              <div className="cal-weekstrip" style={{ marginBottom: 10 }}>
                <div className="cal-wk">
                  <span className="faint">Week {wi + 1}</span>
                  <span className="muted">{wkTrades} trade{wkTrades === 1 ? '' : 's'}</span>
                  <div className="spacer" />
                  <span className={`mono ${wkPnl > 0 ? 'pos' : wkPnl < 0 ? 'neg' : 'flat'}`}
                        style={{ fontWeight: 650 }}>
                    {money(wkPnl, { sign: true })}
                  </span>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}
