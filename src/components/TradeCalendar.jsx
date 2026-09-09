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
 * Month grid of daily P&L with a running total beside each week.
 * Green days are winners, red are losers. Saturday and Sunday are greyed
 * out — markets are shut — but still render a trade if one is logged there.
 */
export default function TradeCalendar({ trades, month, onSelectDay, selectedDay }) {
  const today = todayStr()

  const weeks = useMemo(() => {
    const map = Object.fromEntries(byDay(trades).map((d) => [d.date, d]))
    const [y, m] = month.split('-').map(Number)
    const first = new Date(y, m - 1, 1)
    const lead = (first.getDay() + 6) % 7 // Monday-based offset
    const gridStart = addDays(toDateStr(first), -lead)

    const days = Array.from({ length: 42 }, (_, i) => {
      const date = addDays(gridStart, i)
      const d = map[date]
      const dow = (parseDateStr(date).getDay() + 6) % 7 // Mon=0 … Sun=6
      return {
        date,
        inMonth: date.slice(0, 7) === month,
        isWeekend: dow >= 5,
        pnl: d?.pnl ?? 0,
        count: d?.trades ?? 0,
        dayNum: parseDateStr(date).getDate(),
      }
    })

    const rows = []
    for (let i = 0; i < days.length; i += 7) rows.push(days.slice(i, i + 7))
    while (rows.length > 4 && rows[rows.length - 1].every((d) => !d.inMonth)) rows.pop()
    return rows
  }, [trades, month])

  return (
    <div className="cal">
      <div className="cal-head">
        {DOW.map((d, i) => (
          <span key={d} className={i >= 5 ? 'weekend-head' : ''}>{d}</span>
        ))}
        <span className="total-head">Week</span>
      </div>

      <div className="cal-grid">
        {weeks.map((week, wi) => {
          const wkPnl = week.reduce((a, d) => a + (d.inMonth ? d.pnl : 0), 0)
          const wkTrades = week.reduce((a, d) => a + (d.inMonth ? d.count : 0), 0)

          return (
            <div className="cal-week" key={wi}>
              {week.map((d) => {
                const has = d.count > 0
                const klass = [
                  'cal-cell',
                  d.inMonth ? '' : 'muted-day',
                  d.isWeekend ? 'weekend' : '',
                  has && d.pnl > 0 ? 'win' : '',
                  has && d.pnl < 0 ? 'loss' : '',
                  d.date === today ? 'today' : '',
                ].filter(Boolean).join(' ')

                return (
                  <button
                    key={d.date}
                    className={klass}
                    onClick={() => onSelectDay(d.date === selectedDay ? null : d.date)}
                    title={
                      has
                        ? `${d.date} · ${money(d.pnl, { sign: true })} · ${d.count} trades`
                        : d.isWeekend ? `${d.date} · market closed` : d.date
                    }
                  >
                    <span className="daynum">
                      {d.dayNum}
                      {d.date === selectedDay && (
                        <i className="tag-dot" style={{ background: 'var(--accent)' }} />
                      )}
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

              <div className={`cal-total ${wkTrades === 0 ? 'empty' : ''}`}>
                {wkTrades > 0 ? (
                  <>
                    <span className={`cal-pnl ${wkPnl > 0 ? 'pos' : wkPnl < 0 ? 'neg' : 'flat'}`}>
                      {cell(wkPnl)}
                    </span>
                    <span className="cal-meta">{wkTrades} trade{wkTrades === 1 ? '' : 's'}</span>
                  </>
                ) : (
                  <span className="cal-meta faint">—</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
