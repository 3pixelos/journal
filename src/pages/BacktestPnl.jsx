import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useTitle } from '../lib/hooks'
import {
  money, num, pnlClass, todayStr, parseDateStr, longDate,
} from '../lib/format'
import { stats, byDay } from '../lib/calc'
import { Card, Stat, Empty, Loading, Field, Alert, DeleteButton } from '../components/ui'
import TradeCalendar from '../components/TradeCalendar'
import PaperTradeForm from '../components/PaperTradeForm'

const monthLabel = (m) =>
  parseDateStr(`${m}-01`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

/** The last 24 months, newest first — you backtest the past, not the future. */
function recentMonths(n = 24) {
  const out = []
  const d = new Date()
  d.setDate(1)
  for (let i = 0; i < n; i++) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    d.setMonth(d.getMonth() - 1)
  }
  return out
}

export default function BacktestPnl() {
  useTitle('Backtest P&L')
  const { user } = useAuth()

  const [sessions, setSessions] = useState([])
  const [active, setActive] = useState(null)
  const [trades, setTrades] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const [pickMonth, setPickMonth] = useState(recentMonths()[1] || recentMonths()[0])
  const [startBalance, setStartBalance] = useState('10000')

  const [openDay, setOpenDay] = useState(null)
  const [editing, setEditing] = useState(null)

  const loadSessions = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data } = await supabase
      .from('backtest_sessions').select('*').eq('user_id', user.id)
      .order('month', { ascending: false })
    setSessions(data || [])
    setLoading(false)
  }, [user])

  useEffect(() => { loadSessions() }, [loadSessions])

  const loadTrades = useCallback(async (sessionId) => {
    if (!sessionId) return setTrades([])
    const { data } = await supabase
      .from('backtest_trades').select('*').eq('session_id', sessionId).order('trade_date')
    setTrades(data || [])
  }, [])

  useEffect(() => { loadTrades(active?.id) }, [active?.id, loadTrades])

  async function startMonth() {
    setBusy(true)
    setError('')
    const { data, error: err } = await supabase
      .from('backtest_sessions')
      .insert({
        user_id: user.id,
        month: pickMonth,
        starting_balance: Number(startBalance) || 0,
      })
      .select()
      .single()
    setBusy(false)
    if (err) {
      setError(err.code === '23505'
        ? `You already have a backtest for ${monthLabel(pickMonth)} — open it below.`
        : err.message)
      return
    }
    setSessions((s) => [data, ...s])
    setActive(data)
  }

  async function deleteSession(s) {
    await supabase.from('backtest_sessions').delete().eq('id', s.id)
    if (active?.id === s.id) setActive(null)
    loadSessions()
  }

  async function deleteTrade(t) {
    await supabase.from('backtest_trades').delete().eq('id', t.id)
    setEditing(null)
    loadTrades(active.id)
  }

  // ---- the month's numbers -------------------------------------------
  const s = useMemo(() => stats(trades), [trades])
  const start = Number(active?.starting_balance ?? 0)
  const end = start + s.net
  const growth = start > 0 ? s.net / start : 0
  const days = useMemo(() => byDay(trades), [trades])
  const best = days.length ? days.reduce((a, b) => (b.pnl > a.pnl ? b : a)) : null
  const worst = days.length ? days.reduce((a, b) => (b.pnl < a.pnl ? b : a)) : null

  const dayTrades = useMemo(
    () => (openDay ? trades.filter((t) => t.trade_date === openDay) : []),
    [trades, openDay]
  )

  // ---- month picker ---------------------------------------------------
  if (!active) {
    const taken = new Set(sessions.map((x) => x.month))
    return (
      <div className="col" style={{ gap: 16 }}>
        <div>
          <h2>Backtest with demo money</h2>
          <div className="small muted">
            Pick a month, trade it from a starting balance, and see what you would have
            made. Completely separate from your live journal — none of it reaches your
            calendar, goals or equity curve.
          </div>
        </div>

        <Card title="Which month do you want to backtest?">
          <Alert kind="error">{error}</Alert>
          <div className="row-wrap" style={{ gap: 10, alignItems: 'flex-end' }}>
            <div style={{ minWidth: 190 }} className="grow">
              <Field label="Month">
                <select value={pickMonth} onChange={(e) => setPickMonth(e.target.value)}>
                  {recentMonths().map((m) => (
                    <option key={m} value={m} disabled={taken.has(m)}>
                      {monthLabel(m)}{taken.has(m) ? ' — already started' : ''}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div style={{ minWidth: 150 }}>
              <Field label="Starting balance">
                <input type="number" step="any" value={startBalance}
                       onChange={(e) => setStartBalance(e.target.value)} />
              </Field>
            </div>
            <button className="btn-go" onClick={startMonth} disabled={busy || taken.has(pickMonth)}>
              {busy ? 'Starting…' : 'Start this month'}
            </button>
          </div>
        </Card>

        <Card title="Months you've backtested">
          {loading ? (
            <Loading rows={3} />
          ) : sessions.length === 0 ? (
            <Empty icon="◷" title="Nothing backtested yet"
                   hint="Start with a month you remember trading badly — it is the one that teaches you most." />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Month</th><th className="right">Start</th>
                      <th className="right">Trades</th><th className="right">Result</th><th /></tr>
                </thead>
                <tbody>
                  {sessions.map((x) => (
                    <tr key={x.id} className="clickable" onClick={() => setActive(x)}>
                      <td style={{ fontWeight: 700 }}>{monthLabel(x.month)}</td>
                      <td className="right mono small">{money(x.starting_balance)}</td>
                      <td className="right mono small">—</td>
                      <td className="right small muted">open →</td>
                      <td className="right" onClick={(e) => e.stopPropagation()}>
                        <DeleteButton onDelete={() => deleteSession(x)} label="Delete" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    )
  }

  // ---- an open month --------------------------------------------------
  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="row-wrap">
        <button className="btn-sm btn-ghost" onClick={() => setActive(null)}>← All months</button>
        <div>
          <h2>{monthLabel(active.month)}</h2>
          <div className="small muted">
            Demo money from {money(active.starting_balance)} · click any day to add a trade
          </div>
        </div>
        <div className="spacer" />
        <DeleteButton onDelete={() => deleteSession(active)} label="Delete month" />
      </div>

      <div className={`hero ${s.net < 0 ? 'behind' : ''}`}>
        <div className="row hero-top">
          <div>
            <div className="hero-label">Month result</div>
            <div className={`hero-value ${pnlClass(s.net)}`}>{money(s.net, { sign: true })}</div>
            <div className="hero-sub">
              {s.count} trade{s.count === 1 ? '' : 's'} · {(s.winRate * 100).toFixed(0)}% win rate
            </div>
          </div>
          <div className="spacer" />
          <div className="right hero-goal">
            <div className="hero-label">Balance</div>
            <div style={{ fontSize: 21, fontWeight: 760, letterSpacing: '-0.03em' }}>
              {money(end)}
            </div>
            <div className="tiny faint">
              from {money(start)} · {growth >= 0 ? '+' : ''}{(growth * 100).toFixed(1)}%
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-4">
        <Stat label="Win rate" value={`${(s.winRate * 100).toFixed(0)}%`}
              sub={`${s.wins}W · ${s.losses}L`} />
        <Stat label="Profit factor"
              value={s.profitFactor === Infinity ? '∞' : num(s.profitFactor)}
              sub={`${money(s.grossWin)} / ${money(s.grossLoss)}`} />
        <Stat label="Expectancy" value={money(s.expectancy, { sign: true })}
              tone={pnlClass(s.expectancy)} sub="per trade" />
        <Stat label="Best / worst day"
              value={best ? money(best.pnl, { sign: true }) : '—'}
              tone={best ? pnlClass(best.pnl) : ''}
              sub={worst ? `worst ${money(worst.pnl, { sign: true })}` : 'no days yet'} />
      </div>

      <Card title={`${monthLabel(active.month)} — click a day to trade it`}>
        <TradeCalendar
          trades={trades}
          month={active.month}
          selectedDay={openDay}
          onSelectDay={setOpenDay}
        />
        {trades.length === 0 && (
          <div className="small muted center" style={{ marginTop: 14 }}>
            Nothing logged yet. Click any weekday to put your first demo trade on it.
          </div>
        )}
      </Card>

      {openDay && !editing && (
        <Card
          title={longDate(openDay)}
          action={
            <div className="row" style={{ gap: 8 }}>
              <button className="btn-go btn-sm" onClick={() => setEditing({ isNew: true })}>
                ＋ Demo trade
              </button>
              <button className="btn-ghost btn-sm" onClick={() => setOpenDay(null)}>✕</button>
            </div>
          }
        >
          {dayTrades.length === 0 ? (
            <Empty icon="○" title="Nothing on this day yet" />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Contract</th><th>Dir</th><th className="right">Entry</th>
                      <th className="right">Exit</th><th>Note</th><th className="right">P&L</th></tr>
                </thead>
                <tbody>
                  {dayTrades.map((t) => (
                    <tr key={t.id} className="clickable" onClick={() => setEditing(t)}>
                      <td style={{ fontWeight: 700 }}>{t.contract}</td>
                      <td>
                        <span className={`chip dir-${t.direction}`}>
                          {t.direction === 'long' ? '↑ Long' : '↓ Short'}
                        </span>
                      </td>
                      <td className="right mono small">{t.entry_price ?? '—'}</td>
                      <td className="right mono small">{t.exit_price ?? '—'}</td>
                      <td className="small muted">{t.note || '—'}</td>
                      <td className={`right mono ${pnlClass(t.pnl)}`} style={{ fontWeight: 700 }}>
                        {money(t.pnl, { sign: true })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {editing && (
        <PaperTradeForm
          sessionId={active.id}
          date={openDay || todayStr()}
          trade={editing.isNew ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => loadTrades(active.id)}
          onDeleted={deleteTrade}
        />
      )}
    </div>
  )
}
