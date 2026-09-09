import { useState } from 'react'
import { useSignedUrls } from '../lib/hooks'
import { longDate, relTime } from '../lib/format'
import { JOURNAL_FIELDS } from './JournalFields'
import OutcomeBadge, { OUTCOMES } from './OutcomeBadge'
import Avatar from './Avatar'
import { Modal, TagChip, Lightbox, Empty } from './ui'

/** The whole entry in a popup: pictures, every written section, and — if it's
 *  yours — marking it win/loss, flipping visibility, or opening the editor. */
export default function JournalDetail({
  entry, author, tags = [], paths = [], isMine, onClose, onEdit, onMark,
}) {
  const [zoom, setZoom] = useState(null)
  const urls = useSignedUrls(paths)
  const written = JOURNAL_FIELDS.filter((f) => String(entry[f.key] || '').trim())
  const name = isMine ? 'You' : (author?.display_name || 'Trader')

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
        <span className="chip">{entry.is_shared ? '◉ Public' : '🔒 Private'}</span>
      </div>

      {isMine && (
        <div className="row-wrap" style={{ gap: 6 }}>
          <span className="tiny faint">Mark as:</span>
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
          >
            Make {entry.is_shared ? 'private' : 'public'}
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

      {written.length === 0 && paths.length === 0 ? (
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
