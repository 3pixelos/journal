import { useSignedUrls } from '../lib/hooks'
import { tinyDate } from '../lib/format'
import { OutcomeBadge } from './JournalEntryCard'

/** Picture-first tile for the journal grid. */
export default function JournalCard({ entry, author, paths = [], isMine, onOpen }) {
  const urls = useSignedUrls(paths.slice(0, 1))
  const cover = paths[0] ? urls[paths[0]] : null
  const name = isMine ? 'You' : (author?.display_name || 'Trader')

  const excerpt = [entry.setup, entry.reasoning, entry.emotions, entry.mistakes]
    .filter(Boolean).join(' — ')

  return (
    <button className="jcard" onClick={() => onOpen(entry)}>
      <div className="jcard-media">
        {cover ? (
          <img src={cover} alt="" loading="lazy" />
        ) : paths.length ? (
          <div className="skeleton" style={{ width: '100%', height: '100%' }} />
        ) : (
          <span className="noimg">✎</span>
        )}
        <div className="badges">
          <OutcomeBadge outcome={entry.outcome} />
          {!entry.is_shared && <span className="chip">🔒</span>}
        </div>
        {paths.length > 1 && <span className="count">{paths.length} shots</span>}
      </div>
      <div className="jcard-body">
        <div className="jcard-title">{entry.title || 'Journal entry'}</div>
        <div className="jcard-meta">
          <span>{name}</span><span className="faint">·</span>
          <span>{tinyDate(entry.entry_date)}</span>
        </div>
        {excerpt && <div className="jcard-excerpt">{excerpt}</div>}
      </div>
    </button>
  )
}
