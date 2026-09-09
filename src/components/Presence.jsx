import { usePresence, pageLabel } from '../context/PresenceContext'
import { relTime } from '../lib/format'
import { Card } from './ui'

const initial = (n) => (n || 'T').slice(0, 1).toUpperCase()

/** Compact stack of who is online, for the top bar. */
export function PresenceBar() {
  const { roster } = usePresence()
  const online = roster.filter((r) => r.isOnline)
  if (!online.length) return null

  return (
    <div className="presence-row" title={online.map((o) => o.display_name).join(', ')}>
      <div className="avatar-stack">
        {online.slice(0, 4).map((p) => (
          <span className="avatar-wrap" key={p.id}>
            <span className="avatar sm">{initial(p.display_name)}</span>
            <i className="presence-dot online" />
          </span>
        ))}
      </div>
      <span className="tiny muted nowrap">
        {online.length === 1 && online[0].isMe
          ? 'Only you'
          : `${online.length} online`}
      </span>
    </div>
  )
}

/** Full roster card — who is here now, and when the others were last around. */
export function PresenceCard() {
  const { roster, loading } = usePresence()

  if (loading) return null
  if (roster.length <= 1) {
    return (
      <Card title="Trading floor">
        <div className="small muted">
          It's just you so far. Once your trading partner signs up you'll see when
          they're online here.
        </div>
      </Card>
    )
  }

  return (
    <Card title="Trading floor">
      <div className="col" style={{ gap: 10 }}>
        {roster.map((p) => {
          const where = pageLabel(p.page)
          return (
            <div className="presence-row" key={p.id}>
              <span className="avatar-wrap">
                <span className="avatar">{initial(p.display_name)}</span>
                <i className={`presence-dot ${p.isOnline ? 'online' : ''}`} />
              </span>
              <div className="grow" style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>
                  {p.display_name}{p.isMe && <span className="faint tiny"> · you</span>}
                </div>
                <div className="tiny muted">
                  {p.isOnline
                    ? where ? `Active now · ${where}` : 'Active now'
                    : p.last_seen_at ? `Last seen ${relTime(p.last_seen_at)}` : 'Not seen yet'}
                </div>
              </div>
              {p.isOnline && <span className="chip" style={{ color: 'var(--pos)' }}>Online</span>}
            </div>
          )
        })}
      </div>
    </Card>
  )
}
