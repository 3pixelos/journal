import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useTitle } from '../lib/hooks'
import { loadAttachments, loadTagLinks, deleteJournalEntry } from '../lib/api'
import { removeScreenshot } from '../lib/storage'
import { Card, Empty, Loading, Segmented, TagChip } from '../components/ui'
import JournalForm from '../components/JournalForm'
import JournalEntryCard from '../components/JournalEntryCard'

export default function Journal() {
  useTitle('Journal')
  const { user } = useAuth()

  const [tab, setTab] = useState('mine') // mine | team
  const [entries, setEntries] = useState([])
  const [authors, setAuthors] = useState({})
  const [tagsById, setTagsById] = useState({})
  const [tagLinks, setTagLinks] = useState({})
  const [attachments, setAttachments] = useState({})
  const [trades, setTrades] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [q, setQ] = useState('')
  const [tagFilter, setTagFilter] = useState([])
  const [authorFilter, setAuthorFilter] = useState('')   // '' = everyone
  const [outcomeFilter, setOutcomeFilter] = useState('')

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)

    let query = supabase
      .from('journal_entries')
      .select('*')
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(200)

    // "mine" = everything I wrote; "team" = every shared entry, mine included.
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
        ? supabase.from('profiles').select('id, display_name').in('id', userIds)
        : Promise.resolve({ data: [] }),
      supabase
        .from('trades').select('id, symbol, direction, trade_date')
        .eq('user_id', user.id)
        .order('trade_date', { ascending: false })
        .limit(120),
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

  const allTags = useMemo(() => Object.values(tagsById), [tagsById])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return entries.filter((e) => {
      if (tagFilter.length) {
        const has = tagLinks[e.id] || []
        if (!tagFilter.every((id) => has.includes(id))) return false
      }
      if (authorFilter && e.user_id !== authorFilter) return false
      if (outcomeFilter && e.outcome !== outcomeFilter) return false
      if (!needle) return true
      const hay = [e.title, e.setup, e.reasoning, e.emotions, e.mistakes, e.improvements]
        .filter(Boolean).join(' ').toLowerCase()
      return hay.includes(needle)
    })
  }, [entries, q, tagFilter, tagLinks, authorFilter, outcomeFilter])

  // Who has written in the feed, for the by-person filter
  const people = useMemo(() => {
    const counts = new Map()
    for (const e of entries) {
      counts.set(e.user_id, (counts.get(e.user_id) || 0) + 1)
    }
    return [...counts.entries()]
      .map(([id, count]) => ({
        id,
        count,
        name: authors[id]?.display_name || 'Trader',
        isMe: id === user.id,
      }))
      .sort((a, b) => Number(b.isMe) - Number(a.isMe) || b.count - a.count)
  }, [entries, authors, user])

  async function handleMark(entry, outcome, isShared) {
    const patch = { outcome }
    if (isShared !== undefined) patch.is_shared = isShared
    setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, ...patch } : e)))
    await supabase.from('journal_entries').update(patch).eq('id', entry.id)
    load()
  }

  async function handleDelete(entry) {
    const orphans = await deleteJournalEntry(entry.id)
    await Promise.all(orphans.map(removeScreenshot))
    setShowForm(false)
    setEditing(null)
    load()
  }

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
        <button className="btn-primary" onClick={() => { setEditing(null); setShowForm(true) }}>
          ＋ New entry
        </button>
      </div>

      {tab === 'team' && (
        <div className="alert info">
          Everyone's shared entries live here. Trades, P&L and account numbers are never shared —
          only what people write, their tags and their charts.
        </div>
      )}

      <Card>
        <div className="row-wrap" style={{ gap: 10 }}>
          <input
            className="grow"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search entries…"
            style={{ minWidth: 180 }}
          />
          <Segmented
            value={outcomeFilter}
            onChange={(v) => setOutcomeFilter(outcomeFilter === v ? '' : v)}
            options={[
              { value: '', label: 'All' },
              { value: 'win', label: 'Wins' },
              { value: 'loss', label: 'Losses' },
            ]}
          />
        </div>

        {tab === 'team' && people.length > 1 && (
          <div className="row-wrap mt" style={{ gap: 6 }}>
            <span className="tiny faint">Whose journal:</span>
            <span
              className={`chip chip-btn ${authorFilter === '' ? 'on' : ''}`}
              onClick={() => setAuthorFilter('')}
            >
              Everyone
            </span>
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
        {allTags.length > 0 && (
          <div className="row-wrap mt" style={{ gap: 6 }}>
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
        )}
      </Card>

      <Card>
        {loading ? (
          <Loading rows={6} />
        ) : filtered.length === 0 ? (
          <Empty
            icon="✎"
            title={tab === 'mine' ? 'No journal entries yet' : 'Nothing shared yet'}
            hint={
              tab === 'mine'
                ? 'Write down the setup, your reasoning and how you felt. That is where the edge comes from.'
                : 'Once anyone shares an entry it will show up here.'
            }
            action={
              tab === 'mine' ? (
                <button className="btn-primary" onClick={() => { setEditing(null); setShowForm(true) }}>
                  ＋ Write your first entry
                </button>
              ) : null
            }
          />
        ) : (
          filtered.map((e) => (
            <JournalEntryCard
              key={e.id}
              entry={e}
              author={authors[e.user_id]}
              isMine={e.user_id === user.id}
              tags={(tagLinks[e.id] || []).map((id) => tagsById[id]).filter(Boolean)}
              paths={attachments[e.id] || []}
              onEdit={(en) => { setEditing(en); setShowForm(true) }}
              onMark={handleMark}
            />
          ))
        )}
      </Card>

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
