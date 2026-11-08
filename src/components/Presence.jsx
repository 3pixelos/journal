import { useState } from 'react'
import { usePresence } from '../context/PresenceContext'
import { useFloorStats } from '../lib/hooks'
import { EMPTY_STATS } from '../lib/floor'
import { relTime, longDate } from '../lib/format'
import { Modal } from './ui'
import Avatar from './Avatar'

/** Compact stack of who is online, for the top bar. */
export function PresenceBar() {
  const { roster } = usePresence()
  const online = roster.filter((r) => r.isOnline)
  if (!online.length) return null

  return (
    <div className="presence-row" title={online.map((o) => o.display_name).join(', ')}>
      <div className="avatar-stack">
        {online.slice(0, 4).map((p) => (
          <Avatar key={p.id} name={p.display_name} avatar={p.avatar} size="sm" dot online />
        ))}
      </div>
      <span className="tiny muted nowrap">
        {online.length === 1 && online[0].isMe ? 'Only you' : `${online.length} online`}
      </span>
    </div>
  )
}

/** Wins in a row, if there are enough of them to be worth saying. */
function Streak({ n }) {
  if (n < 2) return null
  return (
    <span className="streak" title={`${n} wins in a row`}>
      🔥<span>{n}</span>
    </span>
  )
}

/**
 * The trading floor in the sidebar. Everyone with an account stays listed —
 * online first, then whoever is away with when they were last around. Nobody
 * vanishes when they sign out; the group is small enough that the full roster
 * is the useful view. Click anyone to see their record.
 */
export function SidebarPresence() {
  const { roster, loading } = usePresence()
  const { stats } = useFloorStats()
  const [open, setOpen] = useState(null)

  if (loading || roster.length === 0) return null

  return (
    <div className="floor">
      <div className="floor-label">Trading floor</div>
      {roster.map((p) => {
        const s = stats[p.id] || EMPTY_STATS
        return (
          <button
            type="button"
            className={`floor-row ${p.isOnline ? '' : 'away'}`}
            key={p.id}
            onClick={() => setOpen(p)}
            title={`${p.display_name}'s record`}
          >
            <Avatar name={p.display_name} avatar={p.avatar} size="sm" dot online={p.isOnline} />
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="floor-name">
                {p.display_name}
                {p.isMe && <span className="tiny faint"> · you</span>}
              </div>
              <div className="floor-when">
                {p.isOnline
                  ? 'Active now'
                  : p.last_seen_at ? relTime(p.last_seen_at) : 'Not seen yet'}
              </div>
            </div>
            <Streak n={s.streak} />
          </button>
        )
      })}

      {open && (
        <TraderCard
          trader={open}
          stats={stats[open.id] || EMPTY_STATS}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  )
}

/**
 * Somebody's record, read from the shared journal rather than their trades,
 * plus a count of the backtests they have run.
 *
 * There is no money on this card and there never will be: P&L is private per
 * user, and the journal is the only thing the two of you agreed to share.
 * The backtest figure is a count and nothing else, for the same reason.
 */
function TraderCard({ trader, stats, onClose }) {
  const s = stats
  return (
    <Modal title={trader.display_name} onClose={onClose}>
      <div className="col" style={{ gap: 16 }}>
        <div className="row" style={{ gap: 13, alignItems: 'center' }}>
          <Avatar name={trader.display_name} avatar={trader.avatar} size="lg" />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 750, fontSize: 17 }}>
              {trader.display_name}
              {s.streak >= 2 && <span className="streak big">🔥<span>{s.streak}</span></span>}
            </div>
            <div className="small muted">
              {trader.isOnline
                ? 'Active now'
                : trader.last_seen_at ? `Last seen ${relTime(trader.last_seen_at)}` : 'Not seen yet'}
            </div>
          </div>
        </div>

        {trader.bio
          ? <div className="bio">{trader.bio}</div>
          : <div className="small faint">No bio yet.</div>}

        <div className="grid grid-2" style={{ gap: 10 }}>
          <div className="card stat">
            <div className="label">Trades journaled</div>
            <div className="value mono">{s.entries}</div>
            <div className="sub">{s.aside > 0 ? `${s.aside} day${s.aside === 1 ? '' : 's'} stood aside` : 'shared entries'}</div>
          </div>
          <div className="card stat">
            <div className="label">Win rate</div>
            <div className="value mono">
              {s.decided ? `${(s.winRate * 100).toFixed(0)}%` : '—'}
            </div>
            <div className="sub">
              {s.wins}W · {s.losses}L{s.be > 0 ? ` · ${s.be} B/E` : ''}
            </div>
          </div>
          <div className="card stat">
            <div className="label">On a run of</div>
            <div className="value mono">{s.streak}</div>
            <div className="sub">best ever {s.best}</div>
          </div>
          <div className="card stat">
            <div className="label">Last journaled</div>
            <div className="value" style={{ fontSize: 15, fontWeight: 700 }}>
              {s.last ? longDate(s.last) : '—'}
            </div>
            <div className="sub">{s.unmarked > 0 ? `${s.unmarked} unmarked` : 'from the journal'}</div>
          </div>
          <div className="card stat" style={{ gridColumn: '1 / -1' }}>
            <div className="label">Backtests run</div>
            <div className="value mono">{s.backtests}</div>
            <div className="sub">
              {s.backtests > 0
                ? `${s.btJournal} backtested · ${s.btDemo} on backtest P&L`
                : 'Backtesting and Backtest P&L together'}
            </div>
          </div>
        </div>

        <div className="tiny faint">
          Counted from shared journal entries, so it is the same record
          everybody else sees. Backtests are a bare count of both backtest
          pages — no demo money travels with it. Money stays private.
        </div>
      </div>
    </Modal>
  )
}
