import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useTags, useAccounts, useTitle } from '../lib/hooks'
import { loadTagLinks, deleteTrade } from '../lib/api'
import { removeScreenshot } from '../lib/storage'
import { money, pnlClass, shortDate, todayStr, startOfMonth, num } from '../lib/format'
import { stats } from '../lib/calc'
import { Card, Empty, Loading, Field, TagChip, Stat } from '../components/ui'
import TradeForm from '../components/TradeForm'

const RANGES = [
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'all', label: 'All time' },
  { value: 'custom', label: 'Custom' },
]

export default function Trades() {
  useTitle('Trades')
  const { user } = useAuth()
  const { tags } = useTags()
  const { accounts } = useAccounts()

  const [trades, setTrades] = useState([])
  const [tagLinks, setTagLinks] = useState({})
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [showForm, setShowForm] = useState(false)

  const [range, setRange] = useState('month')
  const [from, setFrom] = useState(startOfMonth())
  const [to, setTo] = useState(todayStr())
  const [q, setQ] = useState('')
  const [dir, setDir] = useState('')
  const [accountId, setAccountId] = useState('')
  const [tagFilter, setTagFilter] = useState([])

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    let query = supabase
      .from('trades')
      .select('*')
      .eq('user_id', user.id)
      .order('trade_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (range !== 'all') {
      query = query.gte('trade_date', from).lte('trade_date', to)
    }
    const { data } = await query
    const rows = data || []
    setTrades(rows)
    setTagLinks(await loadTagLinks('trade_tags', 'trade_id', rows.map((t) => t.id)))
    setLoading(false)
  }, [user, range, from, to])

  useEffect(() => { load() }, [load])

  // keep the date inputs in step with the preset ranges
  useEffect(() => {
    const today = todayStr()
    if (range === 'month') { setFrom(startOfMonth()); setTo(today) }
    if (range === 'week') {
      const d = new Date()
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
      const p = (x) => String(x).padStart(2, '0')
      setFrom(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`)
      setTo(today)
    }
  }, [range])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return trades.filter((t) => {
      if (needle && !t.symbol.toLowerCase().includes(needle)) return false
      if (dir && t.direction !== dir) return false
      if (accountId && t.account_id !== accountId) return false
      if (tagFilter.length) {
        const has = tagLinks[t.id] || []
        if (!tagFilter.every((id) => has.includes(id))) return false
      }
      return true
    })
  }, [trades, q, dir, accountId, tagFilter, tagLinks])

  const s = useMemo(() => stats(filtered), [filtered])
  const accountName = (id) => accounts.find((a) => a.id === id)?.name

  async function handleDelete(trade) {
    const orphans = await deleteTrade(trade.id)
    await Promise.all(orphans.map(removeScreenshot))
    setShowForm(false)
    setEditing(null)
    load()
  }

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="row-wrap">
        <div className="grow" />
        <button
          className="btn-primary"
          onClick={() => { setEditing(null); setShowForm(true) }}
        >
          ＋ Log trade
        </button>
      </div>

      <div className="grid grid-4">
        <Stat label="Net P&L" value={money(s.net, { sign: true })} tone={pnlClass(s.net)}
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
          <div style={{ minWidth: 130 }}>
            <Field label="Range">
              <select value={range} onChange={(e) => setRange(e.target.value)}>
                {RANGES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </Field>
          </div>
          {range === 'custom' && (
            <>
              <div style={{ minWidth: 140 }}>
                <Field label="From"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
              </div>
              <div style={{ minWidth: 140 }}>
                <Field label="To"><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
              </div>
            </>
          )}
          <div style={{ minWidth: 120 }}>
            <Field label="Symbol"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="All" /></Field>
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

      <Card>
        {loading ? (
          <Loading rows={5} />
        ) : filtered.length === 0 ? (
          <Empty
            icon="▤"
            title="No trades here yet"
            hint="Log your first trade to start building the record."
            action={
              <button className="btn-primary" onClick={() => { setEditing(null); setShowForm(true) }}>
                ＋ Log trade
              </button>
            }
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
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
                {filtered.map((t) => (
                  <tr
                    key={t.id}
                    className="clickable"
                    onClick={() => { setEditing(t); setShowForm(true) }}
                  >
                    <td className="nowrap muted small">{shortDate(t.trade_date)}</td>
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
        )}
      </Card>

      {showForm && (
        <TradeForm
          trade={editing}
          onClose={() => { setShowForm(false); setEditing(null) }}
          onSaved={load}
          onDeleted={handleDelete}
        />
      )}
    </div>
  )
}
