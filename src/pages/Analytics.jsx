import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, Cell,
} from 'recharts'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useTags, useTitle } from '../lib/hooks'
import { loadTagLinks } from '../lib/api'
import { money, num, pnlClass, shortDate, tinyDate, todayStr, addDays, startOfMonth } from '../lib/format'
import {
  stats, byDay, byWeek, byMonth, equityCurve, maxDrawdown, groupStats,
  weekdayOf, WEEKDAYS,
} from '../lib/calc'
import { Card, Stat, Empty, Loading, Segmented } from '../components/ui'

const RANGES = [
  { value: '30', label: '30d' },
  { value: '90', label: '90d' },
  { value: 'ytd', label: 'YTD' },
  { value: 'all', label: 'All' },
]

const chartTooltip = {
  contentStyle: { background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 8 },
}

export default function Analytics() {
  useTitle('Analytics')
  const { user } = useAuth()
  const { tags } = useTags()

  const [trades, setTrades] = useState([])
  const [tagLinks, setTagLinks] = useState({})
  const [range, setRange] = useState('90')
  const [grouping, setGrouping] = useState('day')
  const [loading, setLoading] = useState(true)

  const from = useMemo(() => {
    if (range === 'all') return '1970-01-01'
    if (range === 'ytd') return `${new Date().getFullYear()}-01-01`
    return addDays(todayStr(), -Number(range) + 1)
  }, [range])

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data: t } = await supabase
      .from('trades').select('*').eq('user_id', user.id)
      .gte('trade_date', from).order('trade_date')
    const rows = t || []
    setTrades(rows)
    setTagLinks(await loadTagLinks('trade_tags', 'trade_id', rows.map((r) => r.id)))
    setLoading(false)
  }, [user, from])

  useEffect(() => { load() }, [load])

  const s = useMemo(() => stats(trades), [trades])
  const days = useMemo(() => byDay(trades), [trades])
  const curve = useMemo(() => equityCurve(trades), [trades])
  const dd = useMemo(() => maxDrawdown(curve), [curve])

  const periodRows = useMemo(() => {
    if (grouping === 'week') return byWeek(trades).map((r) => ({ key: r.week, label: tinyDate(r.week), pnl: r.pnl, trades: r.trades }))
    if (grouping === 'month') return byMonth(trades).map((r) => ({ key: r.month, label: r.month, pnl: r.pnl, trades: r.trades }))
    return days.map((r) => ({ key: r.date, label: tinyDate(r.date), pnl: r.pnl, trades: r.trades }))
  }, [grouping, trades, days])

  const bySymbol = useMemo(() => groupStats(trades, (t) => t.symbol).slice(0, 12), [trades])
  const byWeekday = useMemo(() => {
    const g = groupStats(trades, (t) => weekdayOf(t.trade_date))
    return WEEKDAYS.map((d) => g.find((x) => x.key === d) || { key: d, net: 0, count: 0, winRate: 0 })
  }, [trades])
  const byDirection = useMemo(() => groupStats(trades, (t) => t.direction), [trades])

  const byTag = useMemo(() => {
    const rows = groupStats(trades, (t) => tagLinks[t.id] || [])
    return rows
      .map((r) => ({ ...r, tag: tags.find((x) => x.id === r.key) }))
      .filter((r) => r.tag)
  }, [trades, tagLinks, tags])

  const bestDay = days.length ? days.reduce((a, b) => (b.pnl > a.pnl ? b : a)) : null
  const worstDay = days.length ? days.reduce((a, b) => (b.pnl < a.pnl ? b : a)) : null

  const greenDays = days.filter((d) => d.pnl > 0).length

  if (loading) return <Card><Loading rows={6} /></Card>

  if (!trades.length) {
    return (
      <Card>
        <Empty icon="◫" title="No trades in this range"
               hint="Log some trades, or widen the date range, to see your analytics." />
      </Card>
    )
  }

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="row-wrap">
        <Segmented value={range} onChange={setRange} options={RANGES} />
        <div className="spacer" />
        <span className="small muted">{trades.length} trades since {shortDate(days[0].date)}</span>
      </div>

      <div className="grid grid-4">
        <Stat label="Net P&L" value={money(s.net, { sign: true })} tone={pnlClass(s.net)}
              sub={`${s.count} trades`} />
        <Stat label="Win rate" value={`${(s.winRate * 100).toFixed(1)}%`} sub={`${s.wins}W · ${s.losses}L`} />
        <Stat label="Profit factor" value={s.profitFactor === Infinity ? '∞' : num(s.profitFactor)}
              sub={`${money(s.grossWin)} won / ${money(s.grossLoss)} lost`} />
        <Stat label="Expectancy" value={money(s.expectancy, { sign: true })} tone={pnlClass(s.expectancy)}
              sub="per trade" />
      </div>

      <div className="grid grid-4">
        <Stat label="Avg win" value={money(s.avgWin)} tone="pos" sub={`best ${money(s.best)}`} />
        <Stat label="Avg loss" value={money(-s.avgLoss)} tone="neg" sub={`worst ${money(s.worst)}`} />
        <Stat label="Payoff ratio" value={s.payoff === Infinity ? '∞' : `${num(s.payoff)}R`}
              sub="avg win ÷ avg loss" />
        <Stat label="Max drawdown" value={money(-dd)} tone={dd > 0 ? 'neg' : ''}
              sub={`${greenDays}/${days.length} green days`} />
      </div>

      <Card title="Equity curve">
        <div style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={curve} margin={{ top: 6, right: 6, left: -14, bottom: 0 }}>
              <defs>
                <linearGradient id="eq2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--text)" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="var(--text)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
              <XAxis dataKey="date" tickFormatter={tinyDate} tickLine={false} axisLine={false} minTickGap={30} />
              <YAxis tickLine={false} axisLine={false} width={62}
                     tickFormatter={(v) => `$${Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`} />
              <Tooltip {...chartTooltip} formatter={(v) => [money(v), 'Equity']} labelFormatter={shortDate} />
              <Area type="monotone" dataKey="equity" stroke="var(--text)" strokeWidth={2} fill="url(#eq2)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card
        title="P&L over time"
        action={
          <Segmented
            value={grouping}
            onChange={setGrouping}
            options={[
              { value: 'day', label: 'Day' },
              { value: 'week', label: 'Week' },
              { value: 'month', label: 'Month' },
            ]}
          />
        }
      >
        <div style={{ height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={periodRows} margin={{ top: 6, right: 6, left: -14, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={16} />
              <YAxis tickLine={false} axisLine={false} width={62}
                     tickFormatter={(v) => `$${Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`} />
              <Tooltip {...chartTooltip} cursor={{ fill: 'var(--panel-2)' }}
                       formatter={(v, _n, p) => [money(v, { sign: true }), `${p.payload.trades} trades`]} />
              <Bar dataKey="pnl" radius={[3, 3, 0, 0]}>
                {periodRows.map((r) => (
                  <Cell key={r.key} fill={r.pnl >= 0 ? 'var(--pos)' : 'var(--neg)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid grid-2">
        <Card title="Best & worst days">
          <div className="table-wrap">
            <table>
              <tbody>
                <tr>
                  <td className="muted">Best day</td>
                  <td>{bestDay ? shortDate(bestDay.date) : '—'}</td>
                  <td className="right mono pos" style={{ fontWeight: 600 }}>
                    {bestDay ? money(bestDay.pnl, { sign: true }) : '—'}
                  </td>
                </tr>
                <tr>
                  <td className="muted">Worst day</td>
                  <td>{worstDay ? shortDate(worstDay.date) : '—'}</td>
                  <td className="right mono neg" style={{ fontWeight: 600 }}>
                    {worstDay ? money(worstDay.pnl, { sign: true }) : '—'}
                  </td>
                </tr>
                <tr>
                  <td className="muted">Avg day</td>
                  <td className="muted small">{days.length} trading days</td>
                  <td className={`right mono ${pnlClass(s.net / (days.length || 1))}`} style={{ fontWeight: 600 }}>
                    {money(s.net / (days.length || 1), { sign: true })}
                  </td>
                </tr>
                {byDirection.map((d) => (
                  <tr key={d.key}>
                    <td className="muted">{d.key === 'long' ? 'Longs' : 'Shorts'}</td>
                    <td className="muted small">{d.count} trades · {(d.winRate * 100).toFixed(0)}% win</td>
                    <td className={`right mono ${pnlClass(d.net)}`} style={{ fontWeight: 600 }}>
                      {money(d.net, { sign: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="By weekday">
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byWeekday} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                <XAxis dataKey="key" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} width={58}
                       tickFormatter={(v) => `$${Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`} />
                <Tooltip {...chartTooltip} cursor={{ fill: 'var(--panel-2)' }}
                         formatter={(v, _n, p) => [money(v, { sign: true }), `${p.payload.count || 0} trades`]} />
                <Bar dataKey="net" radius={[3, 3, 0, 0]}>
                  {byWeekday.map((d) => (
                    <Cell key={d.key} fill={d.net >= 0 ? 'var(--pos)' : 'var(--neg)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid grid-2">
        <Card title="By symbol">
          <PerfTable rows={bySymbol.map((r) => ({ ...r, label: r.key }))} />
        </Card>

        <Card title="By tag — what actually works">
          {byTag.length === 0 ? (
            <Empty icon="◇" title="No tagged trades yet"
                   hint="Tag your trades by setup or strategy to see which ones pay." />
          ) : (
            <PerfTable
              rows={byTag.map((r) => ({
                ...r,
                label: r.tag.name,
                color: r.tag.color,
                kind: r.tag.kind,
              }))}
            />
          )}
        </Card>
      </div>

    </div>
  )
}

function PerfTable({ rows }) {
  if (!rows.length) return <Empty icon="○" title="Nothing to show yet" />
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
              <td style={{ minWidth: 110 }}>
                <div className="row" style={{ gap: 6 }}>
                  {r.color && <i className="tag-dot" style={{ background: r.color }} />}
                  <span style={{ fontWeight: 600 }}>{r.label}</span>
                </div>
                <div className="bar accent" style={{ marginTop: 5, height: 4 }}>
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
              <td className={`right mono nowrap ${pnlClass(r.net)}`} style={{ fontWeight: 600 }}>
                {money(r.net, { sign: true })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
