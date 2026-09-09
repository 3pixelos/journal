import { useState } from 'react'
import { useSignedUrls } from '../lib/hooks'
import { longDate, relTime } from '../lib/format'
import { JOURNAL_FIELDS } from './JournalFields'
import { TagChip, Lightbox } from './ui'

const OUTCOMES = [
  { value: 'win', label: 'Win', cls: 'pos' },
  { value: 'loss', label: 'Loss', cls: 'neg' },
  { value: 'breakeven', label: 'B/E', cls: 'flat' },
]

export function OutcomeBadge({ outcome }) {
  const o = OUTCOMES.find((x) => x.value === outcome)
  if (!o) return null
  return (
    <span className="chip" style={{
      color: `var(--${o.cls === 'pos' ? 'pos' : o.cls === 'neg' ? 'neg' : 'muted'})`,
      background: o.cls === 'pos' ? 'var(--pos-soft)' : o.cls === 'neg' ? 'var(--neg-soft)' : 'var(--panel-2)',
      borderColor: 'transparent',
    }}>
      {o.label}
    </span>
  )
}

export default function JournalEntryCard({ entry, author, tags = [], paths = [], onEdit, onMark, isMine }) {
  const [zoom, setZoom] = useState(null)
  const urls = useSignedUrls(paths)
  const name = author?.display_name || 'Trader'
  const written = JOURNAL_FIELDS.filter((f) => String(entry[f.key] || '').trim())

  return (
    <div className="feed-item">
      <div className="row">
        <div className="avatar">{name.slice(0, 1).toUpperCase()}</div>
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="row-wrap" style={{ gap: 7 }}>
            <strong>{entry.title || 'Journal entry'}</strong>
            <OutcomeBadge outcome={entry.outcome} />
            {!entry.is_shared && <span className="chip">🔒 Private</span>}
          </div>
          <div className="tiny faint">
            {isMine ? 'You' : name} · {longDate(entry.entry_date)} · {relTime(entry.created_at)}
          </div>
        </div>
        {isMine && onEdit && (
          <button className="btn-ghost btn-sm" onClick={() => onEdit(entry)}>Edit</button>
        )}
      </div>

      {tags.length > 0 && (
        <div className="row-wrap" style={{ gap: 5, marginTop: 9 }}>
          {tags.map((t) => <TagChip key={t.id} tag={t} />)}
        </div>
      )}

      {written.map((f) => (
        <div className="jsection" key={f.key}>
          <div className="k">{f.label}</div>
          <div className="v">{entry[f.key]}</div>
        </div>
      ))}

      {paths.length > 0 && (
        <div className="thumbs" style={{ marginTop: 12 }}>
          {paths.map((p) => (
            <div key={p} className="thumb" onClick={() => urls[p] && setZoom(urls[p])}>
              {urls[p] ? <img src={urls[p]} alt="" /> : <div className="skeleton" style={{ height: '100%' }} />}
            </div>
          ))}
        </div>
      )}

      {isMine && onMark && (
        <div className="row-wrap tiny" style={{ gap: 6, marginTop: 12 }}>
          <span className="faint">{entry.outcome ? 'Outcome:' : 'Mark this later:'}</span>
          {OUTCOMES.map((o) => (
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
            title={entry.is_shared ? 'Make this private' : 'Share with the group'}
          >
            {entry.is_shared ? '◉ Public' : '🔒 Private'}
          </span>
        </div>
      )}

      <Lightbox src={zoom} onClose={() => setZoom(null)} />
    </div>
  )
}
