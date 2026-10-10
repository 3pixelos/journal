import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useTitle, useModels } from '../lib/hooks'
import { loadAttachments, loadTagLinks, deleteJournalEntry } from '../lib/api'
import { removeScreenshot } from '../lib/storage'
import { Card, Empty, Loading, Segmented, Stat, TagChip } from '../components/ui'
import JournalForm from '../components/JournalForm'
import JournalCard from '../components/JournalCard'
import JournalDetail from '../components/JournalDetail'

const pct = (n) => `${(n * 100).toFixed(0)}%`

/**
 * A model is scored on the losses it caused, not the ones you did. Losses
 * marked as your own mistake are held out of the win rate — they say
 * nothing about whether the setup works — but they are counted and shown,
 * because a model that only looks good once your errors are removed is
 * worth knowing about too.
 */
function rate(all) {
  // Days you stood aside are reviewed days, not tested setups — they belong
  // nowhere near a win rate.
  const avoided = all.filter((r) => r.outcome === 'no_trade').length
  const rows = all.filter((r) => r.outcome !== 'no_trade')
  const wins = rows.filter((r) => r.outcome === 'win').length
  const lost = rows.filter((r) => r.outcome === 'loss')
  const mine = lost.filter((r) => r.fault === 'mine').length
  // A news loss is still a loss for the model — it just was not the setup
  // being wrong, so it is counted separately and flagged.
  const news = lost.filter((r) => r.fault === 'news').length
  const strategyLosses = lost.length - mine
  const decided = wins + lost.length
  const judged = wins + strategyLosses
  return {
    tests: rows.length,
    avoided,
    wins,
    losses: lost.length,
    mine,
    news,
    strategyLosses,
    decided,
    judged,
    // what the model did, with your errors removed
    winRate: judged ? wins / judged : 0,
  }
}

export default function Backtesting() {
  useTitle('Backtesting')
  const { user } = useAuth()
  const { models } = useModels()

  const [entries, setEntries] = useState([])
  const [attachments, setAttachments] = useState({})
  const [tagLinks, setTagLinks] = useState({})
  const [tagsById, setTagsById] = useState({})
  const [stepsByEntry, setStepsByEntry] = useState({})
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [detail, setDetail] = useState(null)
  const [q, setQ] = useState('')
  const [modelFilter, setModelFilter] = useState('')
  const [outcomeFilter, setOutcomeFilter] = useState('')

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)

    const { data } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('user_id', user.id)
      .eq('kind', 'backtest')
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(500)

    const rows = data || []
    setEntries(rows)
    const ids = rows.map((r) => r.id)

    const [links, files, { data: checks }] = await Promise.all([
      loadTagLinks('journal_tags', 'journal_entry_id', ids),
      loadAttachments('journal_entry_id', ids),
      ids.length
        ? supabase.from('journal_checks').select('journal_entry_id, check_id').in('journal_entry_id', ids)
        : Promise.resolve({ data: [] }),
    ])

    setTagLinks(links)
    setAttachments(files)
    const byEntry = {}
    for (const c of checks || []) (byEntry[c.journal_entry_id] ||= []).push(c.check_id)
    setStepsByEntry(byEntry)

    const tagIds = [...new Set(Object.values(links).flat())]
    if (tagIds.length) {
      const { data: tg } = await supabase.from('tags').select('*').in('id', tagIds)
      setTagsById(Object.fromEntries((tg || []).map((t) => [t.id, t])))
    } else {
      setTagsById({})
    }
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  // ---- per-model win rate, the point of the whole page ---------------
  const perModel = useMemo(() => {
    const out = models.map((m) => {
      // Stood-aside days are dropped here rather than inside rate(), so no
      // derived bucket below can pick them up — a day you did not trade has
      // nothing to say about whether the model works or where you slipped.
      const rows = entries.filter(
        (e) => e.model_id === m.id && e.outcome !== 'no_trade'
      )
      const total = m.checks.length
      // only meaningful once the model actually has steps to follow
      const clean = total
        ? rows.filter((e) => (stepsByEntry[e.id] || []).length >= total)
        : []
      const messy = total
        ? rows.filter((e) => (stepsByEntry[e.id] || []).length < total)
        : []
      return {
        model: m,
        ...rate(rows),
        clean: rate(clean),
        messy: rate(messy),
        hasSteps: total > 0,
      }
    })
    return out.filter((r) => r.tests > 0).sort((a, b) => b.winRate - a.winRate || b.tests - a.tests)
  }, [models, entries, stepsByEntry])

  const overall = useMemo(() => rate(entries), [entries])
  const allTags = useMemo(() => Object.values(tagsById), [tagsById])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return entries.filter((e) => {
      if (modelFilter && e.model_id !== modelFilter) return false
      if (outcomeFilter && e.outcome !== outcomeFilter) return false
      if (!needle) return true
      const hay = [
        e.title, e.setup, e.reasoning, e.emotions, e.mistakes, e.improvements,
        e.execution_notes, models.find((m) => m.id === e.model_id)?.name,
      ].filter(Boolean).join(' ').toLowerCase()
      return hay.includes(needle)
    })
  }, [entries, q, modelFilter, outcomeFilter, models])

  async function handleMark(entry, outcome, isShared) {
    const patch = { outcome }
    if (isShared !== undefined) patch.is_shared = isShared
    setEntries((p) => p.map((e) => (e.id === entry.id ? { ...e, ...patch } : e)))
    setDetail((d) => (d && d.id === entry.id ? { ...d, ...patch } : d))
    await supabase.from('journal_entries').update(patch).eq('id', entry.id)
    load()
  }

  async function handleFault(entry, fault) {
    setEntries((p) => p.map((e) => (e.id === entry.id ? { ...e, fault } : e)))
    setDetail((d) => (d && d.id === entry.id ? { ...d, fault } : d))
    await supabase.from('journal_entries').update({ fault }).eq('id', entry.id)
    load()
  }

  async function handleDelete(entry) {
    const orphans = await deleteJournalEntry(entry.id)
    await Promise.all(orphans.map(removeScreenshot))
    setShowForm(false); setEditing(null); setDetail(null)
    load()
  }

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="row-wrap">
        <div>
          <h2>Backtesting</h2>
          <div className="small muted">
            Run your models against past price. No money involved — just whether the
            setup actually works.
          </div>
        </div>
        <div className="spacer" />
        <button className="btn-go" onClick={() => { setEditing(null); setShowForm(true) }}>
          ＋ New backtest
        </button>
      </div>

      <div className="grid grid-4">
        <Stat label="Days reviewed" value={overall.tests + overall.avoided}
              sub={[
                `${overall.tests} tested`,
                overall.avoided ? `${overall.avoided} stood aside` : null,
                overall.decided < overall.tests ? `${overall.tests - overall.decided} unmarked` : null,
              ].filter(Boolean).join(' · ')} />
        <Stat label="Days stood aside" value={overall.avoided}
              sub={overall.avoided ? 'never counted against a model' : 'none logged yet'} />
        <Stat label="Strategy win rate" value={overall.judged ? pct(overall.winRate) : '—'}
              tone={overall.winRate >= 0.5 ? 'pos' : overall.judged ? 'neg' : ''}
              sub={[
                `${overall.wins}W · ${overall.strategyLosses}L`,
                overall.mine ? `${overall.mine} of your own excluded` : null,
                overall.news ? `⚡ ${overall.news} to news` : null,
              ].filter(Boolean).join(' · ')} />
        <Stat label="Models tested" value={perModel.length}
              sub={models.length ? `of ${models.length}` : 'none created yet'} />
      </div>

      <Card title="Win rate by model">
        {perModel.length === 0 ? (
          <Empty
            icon="◈"
            title="Nothing tested yet"
            hint="Log a few backtests against a model and its win rate shows up here."
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Model</th>
                  <th className="right">Tests</th>
                  <th className="right">W / L</th>
                  <th className="right">Your errors</th>
                  <th className="right">Strategy win rate</th>
                  <th className="right">Every step followed</th>
                </tr>
              </thead>
              <tbody>
                {perModel.map((r) => (
                  <tr
                    key={r.model.id}
                    className="clickable"
                    onClick={() => setModelFilter(modelFilter === r.model.id ? '' : r.model.id)}
                  >
                    <td style={{ minWidth: 130 }}>
                      <div style={{ fontWeight: 700 }}>{r.model.name}</div>
                      <div className="bar" style={{ marginTop: 5, height: 4 }}>
                        <span
                          style={{
                            width: `${r.winRate * 100}%`,
                            background: r.winRate >= 0.5 ? 'var(--pos)' : 'var(--neg)',
                          }}
                        />
                      </div>
                    </td>
                    <td className="right mono small">{r.tests}</td>
                    <td className="right mono small">{r.wins} / {r.strategyLosses}</td>
                    <td className="right mono small">
                      {r.mine
                        ? <span style={{ color: 'var(--warn)', fontWeight: 700 }}>{r.mine}</span>
                        : <span className="faint">—</span>}
                    </td>
                    <td className={`right mono ${r.winRate >= 0.5 ? 'pos' : 'neg'}`}
                        style={{ fontWeight: 750, fontSize: 15 }}>
                      {r.judged ? pct(r.winRate) : '—'}
                      {r.news > 0 && (
                        <div className="tiny faint" style={{ fontWeight: 500 }}>
                          ⚡ {r.news} to news
                        </div>
                      )}
                    </td>
                    <td className="right small">
                      {!r.hasSteps ? (
                        <span className="faint">no steps listed</span>
                      ) : r.clean.decided === 0 ? (
                        <span className="faint">no clean tests</span>
                      ) : (
                        <>
                          <span className={r.clean.winRate >= 0.5 ? 'pos' : 'neg'}
                                style={{ fontWeight: 700 }}>
                            {pct(r.clean.winRate)}
                          </span>
                          <span className="faint"> ({r.clean.decided})</span>
                          {r.messy.decided > 0 && (
                            <div className="tiny faint">
                              {pct(r.messy.winRate)} when steps were skipped
                            </div>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {perModel.length > 0 && (
          <div className="tiny faint mt">
            Click a model to filter the tests below. "Every step followed" counts only the
            tests where you ticked all of that model's steps.
          </div>
        )}
      </Card>

      <Card>
        <div className="jtool">
          <input className="search" value={q} onChange={(e) => setQ(e.target.value)}
                 placeholder="Search tests by model, setup or note" />
          <select value={modelFilter} onChange={(e) => setModelFilter(e.target.value)}>
            <option value="">All models</option>
            {models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <Segmented
            value={outcomeFilter}
            onChange={(v) => setOutcomeFilter(outcomeFilter === v ? '' : v)}
            options={[
              { value: '', label: 'All' },
              { value: 'win', label: 'Wins' },
              { value: 'loss', label: 'Losses' },
              { value: 'no_trade', label: '⊘ Stood aside' },
            ]}
          />
        </div>
        {allTags.length > 0 && (
          <div className="row-wrap mt" style={{ gap: 6 }}>
            {allTags.map((t) => <TagChip key={t.id} tag={t} />)}
          </div>
        )}
        <div className="jcount mt">
          {filtered.length} of {entries.length} test{entries.length === 1 ? '' : 's'}
        </div>
      </Card>

      {loading ? (
        <Card><Loading rows={5} /></Card>
      ) : filtered.length === 0 ? (
        <Card>
          <Empty
            icon="◇"
            title={entries.length === 0 ? 'No backtests yet' : 'Nothing matches those filters'}
            hint={entries.length === 0
              ? 'Pick a model, scroll back through price, and log what the setup did.'
              : undefined}
            action={entries.length === 0
              ? <button className="btn-go" onClick={() => { setEditing(null); setShowForm(true) }}>
                  ＋ Log your first backtest
                </button>
              : null}
          />
        </Card>
      ) : (
        <div className="gallery">
          {filtered.map((e) => (
            <JournalCard
              key={e.id}
              entry={{
                ...e,
                title: e.title || models.find((m) => m.id === e.model_id)?.name || 'Backtest',
              }}
              isMine
              paths={attachments[e.id] || []}
              onOpen={() => setDetail(e)}
            />
          ))}
        </div>
      )}

      {detail && (
        <JournalDetail
          entry={detail}
          isMine
          tags={(tagLinks[detail.id] || []).map((id) => tagsById[id]).filter(Boolean)}
          paths={attachments[detail.id] || []}
          onClose={() => setDetail(null)}
          onMark={handleMark}
          onFault={handleFault}
          onEdit={(en) => { setDetail(null); setEditing(en); setShowForm(true) }}
        />
      )}

      {showForm && (
        <JournalForm
          entry={editing}
          kind="backtest"
          onClose={() => { setShowForm(false); setEditing(null) }}
          onSaved={load}
          onDeleted={handleDelete}
        />
      )}
    </div>
  )
}
