import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useSignedUrls } from '../lib/hooks'
import { longDate, relTime, money, pnlClass } from '../lib/format'
import { getExecution } from '../lib/contracts'
import { JOURNAL_FIELDS } from './JournalFields'
import OutcomeBadge, { OUTCOMES } from './OutcomeBadge'
import Avatar from './Avatar'
import { Modal, TagChip, Lightbox, Empty } from './ui'

/** The whole entry in a popup: pictures, every written section, and — if it's
 *  yours — marking it win/loss, flipping visibility, or opening the editor. */
export default function JournalDetail({
  entry, trade, author, tags = [], paths = [], isMine, onClose, onEdit, onMark, onFault,
}) {
  const [zoom, setZoom] = useState(null)
  const [model, setModel] = useState(null)
  const [ticked, setTicked] = useState([])

  useEffect(() => {
    let alive = true
    setModel(null)
    setTicked([])
    if (!entry.model_id) return
    ;(async () => {
      const [{ data: m }, { data: mc }, { data: jc }] = await Promise.all([
        supabase.from('models').select('id, name, note').eq('id', entry.model_id).maybeSingle(),
        supabase.from('model_checks').select('id, label, sort_order')
          .eq('model_id', entry.model_id).order('sort_order'),
        supabase.from('journal_checks').select('check_id').eq('journal_entry_id', entry.id),
      ])
      if (!alive) return
      setModel(m ? { ...m, checks: mc || [] } : null)
      setTicked((jc || []).map((r) => r.check_id))
    })()
    return () => { alive = false }
  }, [entry.id, entry.model_id])
  const urls = useSignedUrls(paths)
  const written = JOURNAL_FIELDS.filter((f) => String(entry[f.key] || '').trim())
  const name = isMine ? 'You' : (author?.display_name || 'Trader')
  const exec = getExecution(entry.execution)

  return (
    <Modal
      title={entry.title || 'Journal entry'}
      onClose={onClose}
      wide
      footer={
        <>
          {isMine && (
            <button className="btn-primary" onClick={() => onEdit(entry)}>Edit entry</button>
          )}
          <div className="spacer" />
          <button className="btn-ghost" onClick={onClose}>Close</button>
        </>
      }
    >
      <div className="row-wrap" style={{ gap: 8 }}>
        <Avatar name={author?.display_name || name} avatar={author?.avatar} />
        <div>
          <div style={{ fontWeight: 650 }}>{name}</div>
          <div className="tiny faint">
            {longDate(entry.entry_date)} · written {relTime(entry.created_at)}
          </div>
        </div>
        <div className="spacer" />
        <OutcomeBadge outcome={entry.outcome} />
        {entry.outcome === 'loss' && entry.fault && (
          <span className="chip" style={{
            color: entry.fault === 'mine' ? 'var(--warn)' : 'var(--neg)',
            borderColor: 'transparent',
            background: entry.fault === 'mine' ? 'rgba(245,185,66,0.14)' : 'var(--neg-soft)',
            fontWeight: 700,
          }}>
            {entry.fault === 'mine' ? 'My mistake'
              : entry.fault === 'news' ? '⚡ High-impact news'
              : "Strategy's fault"}
          </span>
        )}
        <span className="chip">{entry.is_shared ? '◉ Public' : '🔒 Private'}</span>
      </div>

      {isMine && trade && (
        <div className="daysum">
          <span className={`big ${pnlClass(trade.pnl)}`}>{money(trade.pnl, { sign: true })}</span>
          <span className="muted small">
            {trade.symbol} · {trade.direction === 'long' ? '↑ Long' : '↓ Short'}
            {trade.entry_price != null && trade.exit_price != null
              && ` · ${trade.entry_price} → ${trade.exit_price}`}
          </span>
          <span className="spacer" />
          <span className="tiny faint">only you see this</span>
        </div>
      )}

      {isMine && (
        <div className="row-wrap" style={{ gap: 6 }}>
          <span className="tiny faint">Mark as:</span>
          {OUTCOMES
            .filter((o) => !(entry.kind === 'backtest' && o.value === 'breakeven'))
            .map((o) => (
            <span
              key={o.value}
              className={`chip chip-btn ${entry.outcome === o.value ? 'on' : ''}`}
              onClick={() => onMark(entry, entry.outcome === o.value ? null : o.value)}
            >
              {o.label}
            </span>
          ))}
          <div className="spacer" />
          <span
            className="chip chip-btn"
            onClick={() => onMark(entry, entry.outcome, !entry.is_shared)}
          >
            Make {entry.is_shared ? 'private' : 'public'}
          </span>
        </div>
      )}

      {isMine && entry.outcome === 'loss' && onFault && (
        <div className="row-wrap" style={{ gap: 6 }}>
          <span className="tiny faint">Whose fault:</span>
          <span
            className={`chip chip-btn ${entry.fault === 'strategy' ? 'on' : ''}`}
            onClick={() => onFault(entry, entry.fault === 'strategy' ? null : 'strategy')}
          >
            The strategy
          </span>
          <span
            className={`chip chip-btn ${entry.fault === 'mine' ? 'on' : ''}`}
            onClick={() => onFault(entry, entry.fault === 'mine' ? null : 'mine')}
          >
            Me
          </span>
          <span
            className={`chip chip-btn ${entry.fault === 'news' ? 'on' : ''}`}
            onClick={() => onFault(entry, entry.fault === 'news' ? null : 'news')}
          >
            ⚡ News
          </span>
        </div>
      )}

      {tags.length > 0 && (
        <div className="row-wrap" style={{ gap: 5 }}>
          {tags.map((t) => <TagChip key={t.id} tag={t} />)}
        </div>
      )}

      {paths.length > 0 && (
        <div className="jshots">
          {paths.map((p) => (
            <div key={p} className="jshot" onClick={() => urls[p] && setZoom(urls[p])}>
              {urls[p]
                ? <img src={urls[p]} alt="" />
                : <div className="skeleton" style={{ height: 180 }} />}
            </div>
          ))}
        </div>
      )}

      {model && (
        <div className="model-read">
          <div className="mr-head">
            <span className="mr-name">{model.name}</span>
            {model.checks.length > 0 && (
              <>
                <span className="faint">·</span>
                <span className={`tiny ${ticked.length === model.checks.length ? 'pos' : 'neg'}`}
                      style={{ fontWeight: 700 }}>
                  {ticked.length} of {model.checks.length} steps
                </span>
              </>
            )}
          </div>
          {model.note && <div className="tiny faint" style={{ marginBottom: 8 }}>{model.note}</div>}
          {model.checks.map((c, i) => {
            const on = ticked.includes(c.id)
            return (
              <div className={`mr-check ${on ? 'on' : 'off'}`} key={c.id}>
                <span className="tick">✓</span>
                <span className="step-n">{i + 1}</span>
                <span>{c.label}</span>
              </div>
            )
          })}
        </div>
      )}

      {exec && (
        <div className={`alert ${exec.tone === 'pos' ? 'ok' : 'error'}`}>
          <strong>{exec.label}</strong> — {exec.hint}
        </div>
      )}

      {entry.execution_notes && (
        <div className="jsection">
          <div className="k">What I actually did</div>
          <div className="v">{entry.execution_notes}</div>
        </div>
      )}

      {written.length === 0 && paths.length === 0 && !entry.execution_notes && !model ? (
        <Empty icon="○" title="Nothing written in this entry yet" />
      ) : (
        written.map((f) => (
          <div className="jsection" key={f.key}>
            <div className="k">{f.label}</div>
            <div className="v">{entry[f.key]}</div>
          </div>
        ))
      )}

      <Lightbox src={zoom} onClose={() => setZoom(null)} />
    </Modal>
  )
}
