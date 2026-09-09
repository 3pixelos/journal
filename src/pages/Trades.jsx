import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useTags, useAccounts, useTitle } from '../lib/hooks'
import { loadTagLinks, deleteTrade } from '../lib/api'
import { removeScreenshot } from '../lib/storage'
import { money, pnlClass, shortDate, longDate, todayStr, num, parseDateStr } from '../lib/format'
import { stats } from '../lib/calc'
import { Card, Empty, Loading, Field, TagChip, Stat, Segmented } from '../components/ui'
import TradeForm from '../components/TradeForm'
import TradeCalendar from '../components/TradeCalendar'
import ReminderTicker from '../components/ReminderTicker'

const monthOf = (d) => d.slice(0, 7)
const monthLabel = (m) =>
  parseDateStr(`${m}-01`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

function shiftMonth(m, delta) {
  const [y, mm] = m.split('-').map(Number)
  const d = new Date(y, mm - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function Trades() {
  useTitle('Trades')
  const { user } = useAuth()
  const { tags } = useTags()
  const { accounts } = useAccounts()

  const [view, setView] = useState('calendar')
  const [month, setMonth] = useState(monthOf(todayStr()))
  const [selectedDay, setSelectedDay] = useState(null)

  const [trades, setTrades] = useState([])
  const [tagLinks, setTagLinks] = useState({})
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [showForm, setShowForm] = useState(false)

  const [q, setQ] = useState('')
  const [dir, setDir] = useState('')
  const [accountId, setAccountId] = useState('')
  const [tagFilter, setTagFilter] = useState([])

  // Load a generous window so the list view and month navigation both work
  // without a round-trip on every click.
  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', user.id)
      .order('trade_date', { ascending: false })
      .order('created_at', { ascending: false })
    const rows = data || []
    setTrades(rows)
    setTagLinks(await loadTagLinks('trade_tags', 'trade_id', rows.map((t) => t.id)))
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  const matchesFilters = useCallback((t) => {
    const needle = q.trim().toLowerCase()
    if (needle && !t.symbol.toLowerCase().includes(needle)) return false
    if (dir && t.direction !== dir) return false
    if (accountId && t.account_id !== accountId) return false
    if (tagFilter.length) {
      const has = tagLinks[t.id] || []
      if (!tagFilter.every((id) => has.includes(id))) return false
    }
    return true
  }, [q, dir, accountId, tagFilter, tagLinks])

  const filtered = useMemo(() => trades.filter(matchesFilters), [trades, matchesFilters])
  const monthTrades = useMemo(
    () => filtered.filter((t) => monthOf(t.trade_date) === month),
    [filtered, month]
  )
  const dayTrades = useMemo(
    () => (selectedDay ? filtered.filter((t) => t.trade_date === selectedDay) : []),
    [filtered, selectedDay]
  )

  const scope = view === 'calendar' ? monthTrades : filtered
  const s = useMemo(() => stats(scope), [scope])
  const accountName = (id) => accounts.find((a) => a.id === id)?.name

  async function handleDelete(trade) {
    const orphans = await deleteTrade(trade.id)
    await Promise.all(orphans.map(removeScreenshot))
    setShowForm(false)
    setEditing(null)
    load()
  }

  const openNew = (date) => {
    setEditing(date ? { trade_date: date } : null)
    setShowForm(true)
  }

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="row-wrap">
        <Segmented
          value={view}
          onChange={(v) => { setView(v); setSelectedDay(null) }}
          options={[
            { value: 'calendar', label: 'Calendar' },
            { value: 'list', label: 'List' },
          ]}
        />
        <div className="spacer" />
        <button className="btn-primary" onClick={() => openNew()}>＋ Log trade</button>
      </div>

      <div className="grid grid-4">
        <Stat label={view === 'calendar' ? 'Net P&L (month)' : 'Net P&L'}
              value={money(s.net, { sign: true })} tone={pnlClass(s.net)}
              sub={`${s.count} trade${s.count === 1 ? '' : 's'}`} />
        <Stat label="Win rate" value={`${(s.winRate * 100).toFixed(0)}%`}
              sub={`${s.wins}W · ${s.losses}L`} />
        <Stat label="Avg win / loss" value={`${money(s.avgWin)} / ${money(-s.avgLoss)}`}
              sub={s.payoff === Infinity ? 'no losses yet' : `${num(s.payoff)}R payoff`} />
        <Stat label="Profit factor"
              value={s.profitFactor === Infinity ? '∞' : num(s.profitFactor)}
              sub={`expectancy ${money(s.expectancy, { sign: true })}/trade`} />
      </div>

      <Card>
        <div className="row-wrap" style={{ gap: 10 }}>
          <div style={{ minWidth: 120 }} className="grow">
            <Field label="Symbol">
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="All symbols" />
            </Field>
          </div>
          <div style={{ minWidth: 110 }}>
            <Field label="Direction">
              <select value={dir} onChange={(e) => setDir(e.target.value)}>
                <option value="">All</option>
                <option value="long">Long</option>
                <option value="short">Short</option>
              </select>
            </Field>
          </div>
          {accounts.length > 0 && (
            <div style={{ minWidth: 130 }}>
              <Field label="Account">
                <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                  <option value="">All</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </Field>
            </div>
          )}
        </div>
        {tags.length > 0 && (
          <div className="row-wrap mt" style={{ gap: 6 }}>
            <span className="tiny faint">Tags:</span>
            {tags.map((t) => (
              <TagChip
                key={t.id}
                tag={t}
                active={tagFilter.includes(t.id)}
                onClick={() =>
                  setTagFilter((f) => (f.includes(t.id) ? f.filter((x) => x !== t.id) : [...f, t.id]))
                }
              />
            ))}
            {tagFilter.length > 0 && (
              <button className="btn-ghost btn-sm" onClick={() => setTagFilter([])}>Clear</button>
            )}
          </div>
        )}
      </Card>

      {loading ? (
        <Card><Loading rows={5} /></Card>
      ) : view === 'calendar' ? (
        <>
          <Card>
            <div className="row-wrap mb">
              <button className="btn-sm btn-ghost" onClick={() => setMonth(shiftMonth(month, -1))}>←</button>
              <h2 style={{ minWidth: 168, textAlign: 'center' }}>{monthLabel(month)}</h2>
              <button className="btn-sm btn-ghost" onClick={() => setMonth(shiftMonth(month, 1))}>→</button>
              <div className="spacer" />
              {month !== monthOf(todayStr()) && (
                <button className="btn-sm" onClick={() => setMonth(monthOf(todayStr()))}>Today</button>
              )}
            </div>
            <TradeCalendar
              trades={monthTrades}
              month={month}
              selectedDay={selectedDay}
              onSelectDay={setSelectedDay}
            />
            {monthTrades.length === 0 && (
              <div className="small muted center" style={{ marginTop: 14 }}>
                No trades in {monthLabel(month)}. Click any day to log one.
              </div>
            )}
          </Card>

          {selectedDay && (
            <Card
              title={longDate(selectedDay)}
              action={
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn-sm" onClick={() => openNew(selectedDay)}>＋ Log on this day</button>
                  <button className="btn-sm btn-ghost" onClick={() => setSelectedDay(null)}>✕</button>
                </div>
              }
            >
              {dayTrades.length === 0 ? (
                <Empty icon="○" title="No trades on this day"
                       action={<button className="btn-primary" onClick={() => openNew(selectedDay)}>＋ Log a trade</button>} />
              ) : (
                <>
                  <div className="row mb">
                    <span className="muted small">{dayTrades.length} trade{dayTrades.length === 1 ? '' : 's'}</span>
                    <div className="spacer" />
                    <span className={`mono ${pnlClass(stats(dayTrades).net)}`} style={{ fontSize: 19, fontWeight: 680 }}>
                      {money(stats(dayTrades).net, { sign: true })}
                    </span>
                  </div>
                  <TradeTable
                    trades={dayTrades}
                    tags={tags}
                    tagLinks={tagLinks}
                    accountName={accountName}
                    onPick={(t) => { setEditing(t); setShowForm(true) }}
                  />
                </>
              )}
            </Card>
          )}
        </>
      ) : (
        <Card>
          {filtered.length === 0 ? (
            <Empty icon="▤" title="No trades here yet"
                   hint="Log your first trade to start building the record."
                   action={<button className="btn-primary" onClick={() => openNew()}>＋ Log trade</button>} />
          ) : (
            <TradeTable
              trades={filtered}
              tags={tags}
              tagLinks={tagLinks}
              accountName={accountName}
              showDate
              onPick={(t) => { setEditing(t); setShowForm(true) }}
            />
          )}
        </Card>
      )}

      <ReminderTicker />

      {showForm && (
        <TradeForm
          trade={editing}
          onClose={() => { setShowForm(false); setEditing(null) }}
          onSaved={load}
          onDeleted={editing?.id ? handleDelete : undefined}
        />
      )}
    </div>
  )
}

function TradeTable({ trades, tags, tagLinks, accountName, onPick, showDate }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {showDate && <th>Date</th>}
            <th>Symbol</th>
            <th>Dir</th>
            <th className="right">Entry</th>
            <th className="right">Exit</th>
            <th className="right">Qty</th>
            <th>Tags</th>
            <th>Account</th>
            <th className="right">P&L</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t) => (
            <tr key={t.id} className="clickable" onClick={() => onPick(t)}>
              {showDate && <td className="nowrap muted small">{shortDate(t.trade_date)}</td>}
              <td style={{ fontWeight: 600 }}>{t.symbol}</td>
              <td>
                <span className={`chip dir-${t.direction}`}>
                  {t.direction === 'long' ? '↑ Long' : '↓ Short'}
                </span>
              </td>
              <td className="right mono small">{t.entry_price ?? '—'}</td>
              <td className="right mono small">{t.exit_price ?? '—'}</td>
              <td className="right mono small">{num(t.quantity, 0)}</td>
              <td>
                <div className="row-wrap" style={{ gap: 4 }}>
                  {(tagLinks[t.id] || []).map((id) => {
                    const tag = tags.find((x) => x.id === id)
                    return tag ? <TagChip key={id} tag={tag} /> : null
                  })}
                </div>
              </td>
              <td className="small muted nowrap">{accountName(t.account_id) || '—'}</td>
              <td className={`right mono nowrap ${pnlClass(t.pnl)}`} style={{ fontWeight: 600 }}>
                {money(t.pnl, { sign: true })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
