import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, CartesianGrid,
  AreaChart, Area,
} from 'recharts'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useTitle } from '../lib/hooks'
import {
  money, pnlClass, shortDate, tinyDate, todayStr, startOfWeek, endOfWeek, addDays, num,
} from '../lib/format'
import { byDay, stats, equityCurve, dateRange } from '../lib/calc'
import { Card, Stat, Empty, Loading } from '../components/ui'
import TradeForm from '../components/TradeForm'
import EditableTarget from '../components/EditableTarget'
import { PresenceCard } from '../components/Presence'

export default function Dashboard() {
  useTitle('Dashboard')
  const { user, profile, settings, setSettings } = useAuth()

  const [trades, setTrades] = useState([])
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const today = todayStr()
  const weekStart = startOfWeek(today)
  const weekEnd = endOfWeek(today)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const since = addDays(today, -120)

    const [{ data: t }, { data: r }] = await Promise.all([
      supabase.from('trades').select('*').eq('user_id', user.id).gte('trade_date', since),
      supabase.from('reminders').select('*').eq('user_id', user.id)
        .eq('is_active', true).order('sort_order'),
    ])

    setTrades(t || [])
    setRules(r || [])
    setLoading(false)
  }, [user, today])

  useEffect(() => { load() }, [load])

  const weekTrades = useMemo(
    () => trades.filter((t) => t.trade_date >= weekStart && t.trade_date <= weekEnd),
    [trades, weekStart, weekEnd]
  )
  const todayTrades = useMemo(() => trades.filter((t) => t.trade_date === today), [trades, today])

  const weekStats = stats(weekTrades)
  const todayStats = stats(todayTrades)
  const allStats = stats(trades)

  const goal = Number(settings?.weekly_goal ?? 0)
  const weeklyMaxLoss = Number(settings?.weekly_max_loss ?? 0)
  const dailyMaxLoss = Number(settings?.daily_max_loss ?? 0)

  const goalPct = goal > 0 ? Math.min(Math.max(weekStats.net / goal, 0), 1) : 0
  const lossPct = weeklyMaxLoss > 0 ? Math.min(Math.max(-weekStats.net / weeklyMaxLoss, 0), 1) : 0
  const dailyLossPct = dailyMaxLoss > 0 ? Math.min(Math.max(-todayStats.net / dailyMaxLoss, 0), 1) : 0

  // Mon..Sun bars for the current week, zero-filled
  const weekDayRows = useMemo(() => {
    const map = Object.fromEntries(byDay(weekTrades).map((d) => [d.date, d]))
    return dateRange(weekStart, weekEnd).map((date) => ({
      date,
      label: shortDate(date).split(' ')[0],
      pnl: map[date]?.pnl ?? 0,
      trades: map[date]?.trades ?? 0,
    }))
  }, [weekTrades, weekStart, weekEnd])

  const curve = useMemo(() => equityCurve(trades), [trades])
  const recent = useMemo(
    () => [...trades].sort((a, b) =>
      b.trade_date.localeCompare(a.trade_date) || String(b.created_at).localeCompare(String(a.created_at))
    ).slice(0, 8),
    [trades]
  )

  async function saveTarget(field, value) {
    const { data } = await supabase
      .from('settings').update({ [field]: value }).eq('user_id', user.id).select().single()
    if (data) setSettings(data)
  }

  const name = profile?.display_name || 'trader'
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening'

  if (loading) return <Card><Loading rows={5} /></Card>

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="row-wrap">
        <div>
          <h2>{greeting}, {name}</h2>
          <div className="small muted">{shortDate(today)} · week of {tinyDate(weekStart)}</div>
        </div>
        <div className="spacer" />
        <button className="btn-primary" onClick={() => setShowForm(true)}>＋ Log trade</button>
      </div>

      <div className="grid grid-4">
        <Stat label="Today" value={money(todayStats.net, { sign: true })} tone={pnlClass(todayStats.net)}
              sub={`${todayStats.count} trade${todayStats.count === 1 ? '' : 's'}`} />
        <Stat label="This week" value={money(weekStats.net, { sign: true })} tone={pnlClass(weekStats.net)}
              sub={`${weekStats.count} trades · ${(weekStats.winRate * 100).toFixed(0)}% win`} />
        <Stat label="Win rate (week)"
              value={`${(weekStats.winRate * 100).toFixed(0)}%`}
              sub={`${weekStats.wins}W · ${weekStats.losses}L`} />
        <Stat label="Profit factor (120d)"
              value={allStats.profitFactor === Infinity ? '∞' : num(allStats.profitFactor)}
              sub={`expectancy ${money(allStats.expectancy, { sign: true })}/trade`} />
      </div>

      <div className="grid grid-2">
        <Card title="Weekly goal">
          <div className="row" style={{ marginBottom: 6 }}>
            <span className={`mono ${pnlClass(weekStats.net)}`} style={{ fontSize: 26, fontWeight: 680 }}>
              {money(weekStats.net, { sign: true })}
            </span>
            <span className="muted small">
              of <EditableTarget value={goal} label="weekly goal"
                                 onSave={(v) => saveTarget('weekly_goal', v)} /> goal
            </span>
          </div>
          <div className="bar pos"><span style={{ width: `${goalPct * 100}%` }} /></div>
          <div className="row tiny faint" style={{ marginTop: 5 }}>
            <span>{(goalPct * 100).toFixed(0)}% of goal</span>
            <div className="spacer" />
            <span>{money(Math.max(goal - weekStats.net, 0))} to go</span>
          </div>
          <div className="tiny faint" style={{ marginTop: 8 }}>
            Click any target to change it.
          </div>

          <div className="mt">
            <div className="row tiny" style={{ marginBottom: 5 }}>
              <span className="faint">Weekly max loss</span>
              <div className="spacer" />
              <span className={lossPct >= 1 ? 'neg' : 'muted'}>
                {money(Math.max(-weekStats.net, 0))} /{' '}
                <EditableTarget value={weeklyMaxLoss} label="weekly max loss"
                                onSave={(v) => saveTarget('weekly_max_loss', v)} />
              </span>
            </div>
            <div className="bar neg"><span style={{ width: `${lossPct * 100}%` }} /></div>
          </div>

          <div className="mt">
            <div className="row tiny" style={{ marginBottom: 5 }}>
              <span className="faint">Daily max loss</span>
              <div className="spacer" />
              <span className={dailyLossPct >= 1 ? 'neg' : 'muted'}>
                {money(Math.max(-todayStats.net, 0))} /{' '}
                <EditableTarget value={dailyMaxLoss} label="daily max loss"
                                onSave={(v) => saveTarget('daily_max_loss', v)} />
              </span>
            </div>
            <div className="bar neg"><span style={{ width: `${dailyLossPct * 100}%` }} /></div>
            {dailyLossPct >= 1 && (
              <div className="alert error" style={{ marginTop: 10 }}>
                Daily loss limit hit. Stop trading for today.
              </div>
            )}
          </div>
        </Card>

        <Card title="This week, by day">
          <div style={{ height: 208 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekDayRows} margin={{ top: 6, right: 4, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} width={54}
                       tickFormatter={(v) => (v === 0 ? '0' : `${v > 0 ? '' : '-'}$${Math.abs(v) >= 1000 ? `${Math.abs(v) / 1000}k` : Math.abs(v)}`)} />
                <Tooltip
                  cursor={{ fill: 'var(--panel-2)' }}
                  contentStyle={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 8 }}
                  formatter={(v, _n, p) => [money(v, { sign: true }), `${p.payload.trades} trades`]}
                  labelFormatter={(l, p) => (p?.[0] ? shortDate(p[0].payload.date) : l)}
                />
                <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                  {weekDayRows.map((d) => (
                    <Cell key={d.date} fill={d.pnl >= 0 ? 'var(--pos)' : 'var(--neg)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid grid-2">
        <Card title="Today's rules" action={<Link className="small" to="/reminders">Edit →</Link>}>
          {rules.length === 0 ? (
            <Empty icon="◆" title="No rules set"
                   hint="Add the rules you want in front of you before every session."
                   action={<Link className="btn btn-primary" to="/reminders">＋ Add rules</Link>} />
          ) : (
            <div className="rules-strip">
              {rules.map((r, i) => (
                <div className="rule-pill" key={r.id}>
                  <span className="rnum">{i + 1}</span>
                  <span className="grow">{r.text}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <PresenceCard />
      </div>

      <Card title="Equity curve" action={<Link className="small" to="/analytics">Full analytics →</Link>}>
        {curve.length < 2 ? (
          <Empty icon="◫" title="Not enough data yet" hint="Log a few trades and the curve will appear here." />
        ) : (
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={curve} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="eq" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--text)" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="var(--text)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                <XAxis dataKey="date" tickFormatter={tinyDate} tickLine={false} axisLine={false} minTickGap={28} />
                <YAxis tickLine={false} axisLine={false} width={54}
                       tickFormatter={(v) => `$${Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`} />
                <Tooltip
                  contentStyle={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 8 }}
                  formatter={(v) => [money(v), 'Equity']}
                  labelFormatter={shortDate}
                />
                <Area type="monotone" dataKey="equity" stroke="var(--text)" strokeWidth={2} fill="url(#eq)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card title="Recent trades" action={<Link className="small" to="/trades">All trades →</Link>}>
        {recent.length === 0 ? (
          <Empty icon="▤" title="No trades logged yet"
                 action={<button className="btn-primary" onClick={() => setShowForm(true)}>＋ Log your first trade</button>} />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Date</th><th>Symbol</th><th>Dir</th><th className="right">Qty</th><th className="right">P&L</th></tr>
              </thead>
              <tbody>
                {recent.map((t) => (
                  <tr key={t.id}>
                    <td className="muted small nowrap">{shortDate(t.trade_date)}</td>
                    <td style={{ fontWeight: 600 }}>{t.symbol}</td>
                    <td><span className={`chip dir-${t.direction}`}>{t.direction === 'long' ? '↑' : '↓'}</span></td>
                    <td className="right mono small">{num(t.quantity, 0)}</td>
                    <td className={`right mono ${pnlClass(t.pnl)}`} style={{ fontWeight: 600 }}>
                      {money(t.pnl, { sign: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showForm && <TradeForm onClose={() => setShowForm(false)} onSaved={load} />}
    </div>
  )
}
