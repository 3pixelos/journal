import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useTitle, useTags } from '../lib/hooks'
import { loadTagLinks } from '../lib/api'
import {
  money, pnlClass, shortDate, tinyDate, todayStr, startOfWeek, endOfWeek,
  startOfMonth, addDays, num, longDate,
} from '../lib/format'
import { byDay, stats, equityCurve, dateRange, groupStats } from '../lib/calc'
import { Card, Stat, Empty, Loading, Segmented } from '../components/ui'
import TradeForm from '../components/TradeForm'
import EditableTarget from '../components/EditableTarget'
import DayModal from '../components/DayModal'
import PerfTable from '../components/PerfTable'

const PERIODS = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
]

/** Goal + loss-limit column names per period, so one control set drives all three. */
const FIELDS = {
  day: { goal: 'daily_goal', loss: 'daily_max_loss', noun: 'today' },
  week: { goal: 'weekly_goal', loss: 'weekly_max_loss', noun: 'this week' },
  month: { goal: 'monthly_goal', loss: 'monthly_max_loss', noun: 'this month' },
}

function endOfMonth(dateStr) {
  const [y, m] = dateStr.split('-').map(Number)
  const d = new Date(y, m, 0)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function Dashboard() {
  useTitle('Dashboard')
  const { user, profile, settings, setSettings } = useAuth()
  const { tags } = useTags()

  const [trades, setTrades] = useState([])
  const [tagLinks, setTagLinks] = useState({})
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formDate, setFormDate] = useState(null)
  const [period, setPeriod] = useState('week')
  const [openDay, setOpenDay] = useState(null)

  const today = todayStr()

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data } = await supabase
      .from('trades').select('*').eq('user_id', user.id)
      .gte('trade_date', addDays(today, -180))
      .order('trade_date', { ascending: false })
    const rows = data || []
    setTrades(rows)
    setTagLinks(await loadTagLinks('trade_tags', 'trade_id', rows.map((t) => t.id)))
    setLoading(false)
  }, [user, today])

  useEffect(() => { load() }, [load])

  // ---- the window the selected period covers --------------------------
  const range = useMemo(() => {
    if (period === 'day') return { from: today, to: today }
    if (period === 'month') return { from: startOfMonth(today), to: endOfMonth(today) }
    return { from: startOfWeek(today), to: endOfWeek(today) }
  }, [period, today])

  const periodTrades = useMemo(
    () => trades.filter((t) => t.trade_date >= range.from && t.trade_date <= range.to),
    [trades, range]
  )

  const s = stats(periodTrades)
  const f = FIELDS[period]
  const goal = Number(settings?.[f.goal] ?? 0)
  const maxLoss = Number(settings?.[f.loss] ?? 0)

  const goalPct = goal > 0 ? Math.min(Math.max(s.net / goal, 0), 1) : 0
  const lossPct = maxLoss > 0 ? Math.min(Math.max(-s.net / maxLoss, 0), 1) : 0
  const behind = s.net < 0

  async function saveTarget(field, value) {
    const { data } = await supabase
      .from('settings').update({ [field]: value }).eq('user_id', user.id).select().single()
    if (data) setSettings(data)
  }

  // ---- current week, calendar-styled --------------------------------
  const weekRows = useMemo(() => {
    const map = Object.fromEntries(byDay(trades).map((d) => [d.date, d]))
    return dateRange(startOfWeek(today), endOfWeek(today)).map((date) => {
      const d = new Date(date)
      const dow = (new Date(date + 'T00:00:00').getDay() + 6) % 7
      return {
        date,
        dayNum: Number(date.slice(8)),
        label: shortDate(date).split(' ')[0],
        isWeekend: dow >= 5,
        pnl: map[date]?.pnl ?? 0,
        count: map[date]?.trades ?? 0,
      }
    })
  }, [trades, today])

  // which setups actually pay, over the selected period
  const byTag = useMemo(() => {
    const rows = groupStats(periodTrades, (t) => tagLinks[t.id] || [])
    return rows
      .map((r) => {
        const tag = tags.find((x) => x.id === r.key)
        return tag ? { ...r, label: tag.name, color: tag.color, kind: tag.kind } : null
      })
      .filter(Boolean)
  }, [periodTrades, tagLinks, tags])

  const untagged = useMemo(
    () => periodTrades.filter((t) => !(tagLinks[t.id] || []).length).length,
    [periodTrades, tagLinks]
  )

  const curve = useMemo(() => equityCurve(trades), [trades])
  const name = profile?.display_name || 'trader'
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  if (loading) return <Card><Loading rows={6} /></Card>

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="row-wrap">
        <div>
          <h2>{greeting}, {name}</h2>
          <div className="small muted">{longDate(today)}</div>
        </div>
        <div className="spacer" />
        <Segmented value={period} onChange={setPeriod} options={PERIODS} />
        <button className="btn-go" onClick={() => { setFormDate(null); setShowForm(true) }}>
          ＋ Log trade
        </button>
      </div>

      {/* ---- the number that matters, big ---- */}
      <div className={`hero ${behind ? 'behind' : ''}`}>
        <div className="row">
          <div>
            <div className="hero-label">
              {period === 'day' ? 'Today' : period === 'week' ? 'This week' : 'This month'}
            </div>
            <div className={`hero-value ${pnlClass(s.net)}`}>{money(s.net, { sign: true })}</div>
            <div className="hero-sub">
              {s.count} trade{s.count === 1 ? '' : 's'} · {(s.winRate * 100).toFixed(0)}% win rate
              {period !== 'day' && ` · ${tinyDate(range.from)} – ${tinyDate(range.to)}`}
            </div>
          </div>
          <div className="spacer" />
          <div className="right">
            <div className="hero-label">Goal {f.noun}</div>
            <div style={{ fontSize: 21, fontWeight: 760, letterSpacing: '-0.03em' }}>
              <EditableTarget value={goal} label={`${period} goal`}
                              onSave={(v) => saveTarget(f.goal, v)} />
            </div>
            <div className="tiny faint">click to customize</div>
          </div>
        </div>

        <div className={`hero-bar ${behind ? 'neg' : ''}`}>
          <span style={{ width: `${(behind ? lossPct : goalPct) * 100}%` }} />
        </div>
        <div className="row tiny faint" style={{ marginTop: 7 }}>
          <span>
            {behind
              ? `${(lossPct * 100).toFixed(0)}% of your max loss used`
              : `${(goalPct * 100).toFixed(0)}% of goal`}
          </span>
          <div className="spacer" />
          <span>
            {behind
              ? `${money(Math.max(maxLoss + s.net, 0))} of room left`
              : `${money(Math.max(goal - s.net, 0))} to go`}
          </span>
        </div>

        <div className="hero-grid">
          <div className="hero-tile">
            <div className="k">Max loss {f.noun}</div>
            <div className={`v ${lossPct >= 1 ? 'neg' : ''}`}>
              <EditableTarget value={maxLoss} label={`${period} max loss`}
                              onSave={(v) => saveTarget(f.loss, v)} />
            </div>
          </div>
          <div className="hero-tile">
            <div className="k">Avg win / loss</div>
            <div className="v">{money(s.avgWin)} / {money(-s.avgLoss)}</div>
          </div>
        </div>

        {lossPct >= 1 && (
          <div className="alert error" style={{ marginTop: 12 }}>
            You've hit your {period === 'day' ? 'daily' : period === 'week' ? 'weekly' : 'monthly'}{' '}
            loss limit. Stop trading.
          </div>
        )}
      </div>

      <div className="grid grid-4">
        <Stat label="Net P&L" value={money(s.net, { sign: true })} tone={pnlClass(s.net)}
              sub={`${s.count} trades`} />
        <Stat label="Win rate" value={`${(s.winRate * 100).toFixed(0)}%`}
              sub={`${s.wins}W · ${s.losses}L`} />
        <Stat label="Profit factor"
              value={s.profitFactor === Infinity ? '∞' : num(s.profitFactor)}
              sub={`${money(s.grossWin)} won / ${money(s.grossLoss)} lost`} />
        <Stat label="Expectancy" value={money(s.expectancy, { sign: true })}
              tone={pnlClass(s.expectancy)} sub="per trade" />
      </div>

      <Card
        title="This week"
        action={<Link className="small" to="/trades">Full calendar →</Link>}
      >
        <div className="weekstrip">
          {weekRows.map((d) => {
            const has = d.count > 0
            const klass = [
              'cal-cell',
              d.isWeekend ? 'weekend' : '',
              has && d.pnl > 0 ? 'win' : '',
              has && d.pnl < 0 ? 'loss' : '',
              d.date === today ? 'today' : '',
            ].filter(Boolean).join(' ')
            return (
              <button key={d.date} className={klass} onClick={() => setOpenDay(d.date)}>
                <span className="daynum">{d.label} {d.dayNum}</span>
                {has && (
                  <>
                    <span className={`cal-pnl ${d.pnl > 0 ? 'pos' : 'neg'}`}>
                      {money(d.pnl, { sign: true, decimals: 0 })}
                    </span>
                    <span className="cal-meta">{d.count} trade{d.count === 1 ? '' : 's'}</span>
                  </>
                )}
              </button>
            )
          })}
        </div>
      </Card>

      <Card
        title="By tag — what actually works"
        action={<Link className="small" to="/trades">Filter trades →</Link>}
      >
        <PerfTable
          rows={byTag}
          emptyTitle="No tagged trades in this period"
          emptyHint="Tag trades by setup or strategy and this tells you which ones make money."
        />
        {byTag.length > 0 && untagged > 0 && (
          <div className="tiny faint" style={{ marginTop: 10 }}>
            {untagged} trade{untagged === 1 ? '' : 's'} in this period {untagged === 1 ? 'has' : 'have'} no
            tag, so {untagged === 1 ? 'it is' : 'they are'} not counted above.
          </div>
        )}
      </Card>

      <Card title="Equity curve">
        {curve.length < 2 ? (
          <Empty icon="◫" title="Not enough data yet"
                 hint="Log a few trades and the curve will appear here." />
        ) : (
          <div style={{ height: 230 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={curve} margin={{ top: 6, right: 6, left: -14, bottom: 0 }}>
                <defs>
                  <linearGradient id="eq" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--pos)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="var(--pos)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                <XAxis dataKey="date" tickFormatter={tinyDate} tickLine={false}
                       axisLine={false} minTickGap={28} />
                <YAxis tickLine={false} axisLine={false} width={58}
                       tickFormatter={(v) => `$${Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`} />
                <Tooltip
                  contentStyle={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 9 }}
                  formatter={(v) => [money(v), 'Equity']} labelFormatter={shortDate}
                />
                <Area type="monotone" dataKey="equity" stroke="var(--pos)" strokeWidth={2.4}
                      fill="url(#eq)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {openDay && (
        <DayModal
          date={openDay}
          trades={trades.filter((t) => t.trade_date === openDay)}
          onClose={() => setOpenDay(null)}
          onPick={(t) => { setOpenDay(null); setFormDate(t); setShowForm(true) }}
          onLog={() => { setFormDate({ trade_date: openDay }); setOpenDay(null); setShowForm(true) }}
        />
      )}

      {showForm && (
        <TradeForm
          trade={formDate}
          onClose={() => { setShowForm(false); setFormDate(null) }}
          onSaved={load}
        />
      )}
    </div>
  )
}
