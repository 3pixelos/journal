import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useTitle, useAccounts, useSignedUrls } from '../lib/hooks'
import { loadAttachments, loadTagLinks, deleteJournalEntry } from '../lib/api'
import { removeScreenshot } from '../lib/storage'
import {
  todayStr, startOfWeek, startOfMonth, addDays, money, pnlClass, tinyDate,
} from '../lib/format'
import { Card, Empty, Loading, Segmented, TagChip } from '../components/ui'
import JournalForm from '../components/JournalForm'
import JournalCard, { OutcomeTag, effectiveOutcome } from '../components/JournalCard'
import JournalDetail from '../components/JournalDetail'

const RANGES = [
  { value: 'all', label: 'All time' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: '30', label: 'Last 30 days' },
  { value: 'custom', label: 'Custom…' },
]

export default function Journal() {
  useTitle('Journal')
  const { user } = useAuth()
  const { accounts } = useAccounts()

  const [tab, setTab] = useState('mine') // mine | team
  const [view, setView] = useState('grid') // grid | list
  const [entries, setEntries] = useState([])
  const [authors, setAuthors] = useState({})
  const [tagsById, setTagsById] = useState({})
  const [tagLinks, setTagLinks] = useState({})
  const [attachments, setAttachments] = useState({})
  const [trades, setTrades] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [detail, setDetail] = useState(null)

  const [q, setQ] = useState('')
  const [range, setRange] = useState('all')
  const [from, setFrom] = useState(startOfMonth(todayStr()))
  const [to, setTo] = useState(todayStr())
  const [accountId, setAccountId] = useState('')
  const [tagFilter, setTagFilter] = useState([])
  const [authorFilter, setAuthorFilter] = useState('')
  const [outcomeFilter, setOutcomeFilter] = useState('')

  const tradesById = useMemo(() => Object.fromEntries(trades.map((t) => [t.id, t])), [trades])

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)

    let query = supabase
      .from('journal_entries')
      .select('*')
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(300)
    query = tab === 'mine' ? query.eq('user_id', user.id) : query.eq('is_shared', true)

    const { data } = await query
    const rows = data || []
    setEntries(rows)

    const ids = rows.map((r) => r.id)
    const userIds = [...new Set(rows.map((r) => r.user_id))]

    const [links, files, { data: profs }, { data: myTrades }] = await Promise.all([
      loadTagLinks('journal_tags', 'journal_entry_id', ids),
      loadAttachments('journal_entry_id', ids),
      userIds.length
        ? supabase.from('profiles').select('id, display_name, avatar').in('id', userIds)
        : Promise.resolve({ data: [] }),
      // Own trades only — the amounts on tiles come from here, and RLS means
      // nobody else's trades ever arrive.
      supabase
        .from('trades')
        .select('id, symbol, direction, trade_date, pnl, entry_price, exit_price, account_id')
        .eq('user_id', user.id)
        .order('trade_date', { ascending: false })
        .limit(400),
    ])

    setTagLinks(links)
    setAttachments(files)
    setAuthors(Object.fromEntries((profs || []).map((p) => [p.id, p])))
    setTrades(myTrades || [])

    const tagIds = [...new Set(Object.values(links).flat())]
    if (tagIds.length) {
      const { data: tg } = await supabase.from('tags').select('*').in('id', tagIds)
      setTagsById(Object.fromEntries((tg || []).map((t) => [t.id, t])))
    } else {
      setTagsById({})
    }
    setLoading(false)
  }, [user, tab])

  useEffect(() => { load() }, [load])

  // keep the date inputs in step with the presets
  useEffect(() => {
    const today = todayStr()
    if (range === 'week') { setFrom(startOfWeek(today)); setTo(today) }
    if (range === 'month') { setFrom(startOfMonth(today)); setTo(today) }
    if (range === '30') { setFrom(addDays(today, -29)); setTo(today) }
  }, [range])

  const allTags = useMemo(() => Object.values(tagsById), [tagsById])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return entries.filter((e) => {
      const trade = tradesById[e.trade_id]
      if (range !== 'all' && (e.entry_date < from || e.entry_date > to)) return false
      if (accountId && trade?.account_id !== accountId) return false
      if (authorFilter && e.user_id !== authorFilter) return false
      if (outcomeFilter) {
        const o = effectiveOutcome(e, e.user_id === user.id ? trade : null)
        if (o !== outcomeFilter) return false
      }
      if (tagFilter.length) {
        const has = tagLinks[e.id] || []
        if (!tagFilter.every((id) => has.includes(id))) return false
      }
      if (!needle) return true
      const hay = [
        e.title, e.setup, e.reasoning, e.emotions, e.mistakes, e.improvements,
        trade?.symbol, trade ? String(trade.pnl) : '',
        ...(tagLinks[e.id] || []).map((id) => tagsById[id]?.name),
        authors[e.user_id]?.display_name,
      ].filter(Boolean).join(' ').toLowerCase()
      return hay.includes(needle)
    })
  }, [entries, q, range, from, to, accountId, authorFilter, outcomeFilter,
      tagFilter, tagLinks, tradesById, tagsById, authors, user])

  const people = useMemo(() => {
    const counts = new Map()
    for (const e of entries) counts.set(e.user_id, (counts.get(e.user_id) || 0) + 1)
    return [...counts.entries()]
      .map(([id, count]) => ({
        id, count, name: authors[id]?.display_name || 'Trader', isMe: id === user.id,
      }))
      .sort((a, b) => Number(b.isMe) - Number(a.isMe) || b.count - a.count)
  }, [entries, authors, user])

  async function handleMark(entry, outcome, isShared) {
    const patch = { outcome }
    if (isShared !== undefined) patch.is_shared = isShared
    setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, ...patch } : e)))
    setDetail((d) => (d && d.id === entry.id ? { ...d, ...patch } : d))
    await supabase.from('journal_entries').update(patch).eq('id', entry.id)
    load()
  }

  async function handleDelete(entry) {
    const orphans = await deleteJournalEntry(entry.id)
    await Promise.all(orphans.map(removeScreenshot))
    setShowForm(false)
    setEditing(null)
    setDetail(null)
    load()
  }

  const openNew = () => { setEditing(null); setShowForm(true) }

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="row-wrap">
        <Segmented
          value={tab}
          onChange={(v) => { setTab(v); setAuthorFilter('') }}
          options={[
            { value: 'mine', label: 'My journal' },
            { value: 'team', label: 'Team feed' },
          ]}
        />
        <div className="spacer" />
        <button className="btn-go" onClick={openNew}>＋ New entry</button>
      </div>

      <Card>
        <div className="jtool">
          <input
            className="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by symbol, amount, setup, tag or note"
          />
          <select value={range} onChange={(e) => setRange(e.target.value)}>
            {RANGES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          {range === 'custom' && (
            <>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </>
          )}
          {tab === 'mine' && accounts.length > 0 && (
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">All accounts</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
          <Segmented
            value={view}
            onChange={setView}
            options={[{ value: 'grid', label: '▦' }, { value: 'list', label: '☰' }]}
          />
        </div>

        <div className="row-wrap mt" style={{ gap: 6 }}>
          <span className="jcount">
            {filtered.length} of {entries.length} entr{entries.length === 1 ? 'y' : 'ies'}
          </span>
          <span className="faint">·</span>
          <Segmented
            value={outcomeFilter}
            onChange={(v) => setOutcomeFilter(outcomeFilter === v ? '' : v)}
            options={[
              { value: '', label: 'All' },
              { value: 'win', label: 'Wins' },
              { value: 'loss', label: 'Losses' },
            ]}
          />
          {allTags.map((t) => (
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

        {tab === 'team' && people.length > 1 && (
          <div className="row-wrap mt" style={{ gap: 6 }}>
            <span className="tiny faint">Whose journal:</span>
            <span className={`chip chip-btn ${authorFilter === '' ? 'on' : ''}`}
                  onClick={() => setAuthorFilter('')}>Everyone</span>
            {people.map((p) => (
              <span
                key={p.id}
                className={`chip chip-btn ${authorFilter === p.id ? 'on' : ''}`}
                onClick={() => setAuthorFilter(authorFilter === p.id ? '' : p.id)}
              >
                {p.isMe ? 'Me' : p.name} · {p.count}
              </span>
            ))}
          </div>
        )}
      </Card>

      {loading ? (
        <Card><Loading rows={6} /></Card>
      ) : filtered.length === 0 ? (
        <Card>
          <Empty
            icon="✎"
            title={entries.length === 0
              ? (tab === 'mine' ? 'No journal entries yet' : 'Nothing shared yet')
              : 'Nothing matches those filters'}
            hint={entries.length === 0 && tab === 'mine'
              ? 'Attach the chart, write the setup and how you felt. That is where the edge comes from.'
              : undefined}
            action={tab === 'mine' && entries.length === 0
              ? <button className="btn-go" onClick={openNew}>＋ Write your first entry</button>
              : null}
          />
        </Card>
      ) : view === 'grid' ? (
        <div className="gallery">
          {filtered.map((e) => (
            <JournalCard
              key={e.id}
              entry={e}
              trade={tradesById[e.trade_id]}
              author={authors[e.user_id]}
              isMine={e.user_id === user.id}
              paths={attachments[e.id] || []}
              onOpen={setDetail}
            />
          ))}
        </div>
      ) : (
        <Card>
          <ListView
            entries={filtered}
            tradesById={tradesById}
            authors={authors}
            attachments={attachments}
            userId={user.id}
            onOpen={setDetail}
          />
        </Card>
      )}

      {detail && (
        <JournalDetail
          entry={detail}
          trade={detail.user_id === user.id ? tradesById[detail.trade_id] : null}
          author={authors[detail.user_id]}
          isMine={detail.user_id === user.id}
          tags={(tagLinks[detail.id] || []).map((id) => tagsById[id]).filter(Boolean)}
          paths={attachments[detail.id] || []}
          onClose={() => setDetail(null)}
          onMark={handleMark}
          onEdit={(en) => { setDetail(null); setEditing(en); setShowForm(true) }}
        />
      )}

      {showForm && (
        <JournalForm
          entry={editing}
          trades={trades}
          onClose={() => { setShowForm(false); setEditing(null) }}
          onSaved={load}
          onDeleted={handleDelete}
        />
      )}
    </div>
  )
}

function ListView({ entries, tradesById, authors, attachments, userId, onOpen }) {
  const firstPaths = entries.map((e) => (attachments[e.id] || [])[0]).filter(Boolean)
  const urls = useSignedUrls(firstPaths)

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th></th><th>Symbol / title</th><th>Outcome</th><th>Date</th>
            <th>By</th><th className="right">P&L</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => {
            const mine = e.user_id === userId
            const trade = mine ? tradesById[e.trade_id] : null
            const cover = (attachments[e.id] || [])[0]
            return (
              <tr key={e.id} className="clickable" onClick={() => onOpen(e)}>
                <td style={{ width: 72 }}>
                  <div className="jlist-thumb">
                    {cover && urls[cover] && <img src={urls[cover]} alt="" />}
                  </div>
                </td>
                <td style={{ fontWeight: 700 }}>
                  {trade?.symbol || e.title || 'Journal entry'}
                  {!e.is_shared && <span className="tiny faint"> 🔒</span>}
                </td>
                <td><OutcomeTag outcome={effectiveOutcome(e, trade)} /></td>
                <td className="small muted nowrap">{tinyDate(e.entry_date)}</td>
                <td className="small muted">{mine ? 'You' : authors[e.user_id]?.display_name || 'Trader'}</td>
                <td className={`right mono nowrap ${trade ? pnlClass(trade.pnl) : 'faint'}`}
                    style={{ fontWeight: 700 }}>
                  {trade ? money(trade.pnl, { sign: true }) : mine ? '—' : ''}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
