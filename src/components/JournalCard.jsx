import { useSignedUrls } from '../lib/hooks'
import { tinyDate, money, pnlClass } from '../lib/format'

/** ↗ Win / ↘ Loss / → B/E — small, inline, next to the symbol. */
export function OutcomeTag({ outcome }) {
  if (!outcome) return null
  const map = {
    win: ['↗', 'Win', 'win'],
    loss: ['↘', 'Loss', 'loss'],
    breakeven: ['→', 'B/E', 'be'],
    no_trade: ['⊘', 'No trade', 'be'],
  }
  const [arrow, label, cls] = map[outcome] || []
  if (!label) return null
  return <span className={`jcard-tag ${cls}`}>{arrow} {label}</span>
}

/** Why a loss happened, stated in the footer so it is readable even on a
 *  card with no chart behind it to carry the band. */
export function FaultTag({ entry }) {
  if (entry.outcome !== 'loss' || !entry.fault) return null
  if (entry.fault === 'mine') return <span className="jcard-tag fault-mine">⚠ My mistake</span>
  if (entry.fault === 'news') return <span className="jcard-tag fault-news">⚡ News</span>
  return null
}

/** Derive an outcome from the linked trade when none was set by hand. */
export function effectiveOutcome(entry, trade) {
  if (entry.outcome) return entry.outcome
  if (!trade) return null
  const p = Number(trade.pnl || 0)
  return p > 0 ? 'win' : p < 0 ? 'loss' : 'breakeven'
}

/**
 * Chart-first tile: the screenshot fills the card, with symbol, outcome and
 * date on the left of the footer and the P&L on the right. The amount only
 * appears on your own entries — everyone else's show who wrote them instead.
 */
export default function JournalCard({ entry, trade, author, paths = [], isMine, onOpen }) {
  const urls = useSignedUrls(paths.slice(0, 1))
  const cover = paths[0] ? urls[paths[0]] : null
  const outcome = effectiveOutcome(entry, isMine ? trade : null)
  const symbol = trade?.symbol || entry.title || 'Journal entry'
  const hasNotes = [entry.setup, entry.reasoning, entry.emotions, entry.mistakes, entry.improvements]
    .some((v) => String(v || '').trim())
  const fill = trade && trade.entry_price != null && trade.exit_price != null
    ? `${trade.entry_price} → ${trade.exit_price}`
    : null

  return (
    <button className="jcard" onClick={() => onOpen(entry)}>
      <div className="jcard-media">
        {cover ? (
          <img src={cover} alt="" loading="lazy" />
        ) : paths.length ? (
          <div className="skeleton" style={{ width: '100%', height: '100%' }} />
        ) : (
          <div className="noimg">
            <span>No chart attached</span>
          </div>
        )}
        {/* At most one band, in order of what the day actually was: a day you
            passed on, then an external hit, then an error of your own. */}
        {entry.outcome === 'no_trade' ? (
          <div className="news-streak stood" aria-label="No trade taken">
            <span>NO TRADE</span>
          </div>
        ) : entry.fault === 'news' ? (
          <div className="news-streak" aria-label="High-impact news">
            <span>HIGH IMPACT NEWS</span>
          </div>
        ) : entry.fault === 'mine' ? (
          <div className="news-streak mine" aria-label="My mistake">
            <span>MY MISTAKE</span>
          </div>
        ) : null}
        {!entry.is_shared && <span className="jcard-lock" title="Private">🔒</span>}
        {paths.length > 1 && <span className="count">{paths.length} shots</span>}
      </div>

      <div className="jcard-foot">
        <div className="jcard-left">
          <div className="row-wrap" style={{ gap: 7, minWidth: 0 }}>
            <span className="jcard-sym">{symbol}</span>
            <OutcomeTag outcome={outcome} />
            <FaultTag entry={entry} />
          </div>
          <div className="jcard-date">
            {tinyDate(entry.entry_date)}
            {!isMine && <> · {author?.display_name || 'Trader'}</>}
          </div>
          <span className={`jcard-pill ${hasNotes ? '' : 'empty'}`}>
            {hasNotes ? 'Journal' : 'No notes'}
          </span>
        </div>

        <div className="jcard-right">
          {isMine && trade ? (
            <>
              <div className={`jcard-pnl ${pnlClass(trade.pnl)}`}>
                {money(trade.pnl, { sign: true })}
              </div>
              <div className="jcard-fill">{fill || 'No fill prices'}</div>
            </>
          ) : isMine ? (
            <div className="jcard-fill">No trade linked</div>
          ) : null}
        </div>
      </div>
    </button>
  )
}
