import { usePresence } from '../context/PresenceContext'
import { relTime } from '../lib/format'
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

/**
 * The trading floor in the sidebar. Everyone with an account stays listed —
 * online first, then whoever is away with when they were last around. Nobody
 * vanishes when they sign out; the group is small enough that the full roster
 * is the useful view.
 */
export function SidebarPresence() {
  const { roster, loading } = usePresence()
  if (loading || roster.length === 0) return null

  return (
    <div className="floor">
      <div className="floor-label">Trading floor</div>
      {roster.map((p) => (
        <div className={`floor-row ${p.isOnline ? '' : 'away'}`} key={p.id}>
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
        </div>
      ))}
    </div>
  )
}
