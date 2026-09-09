import { useTitle } from '../lib/hooks'
import { usePresence, pageLabel } from '../context/PresenceContext'
import { relTime } from '../lib/format'
import { Card, Loading, Empty } from '../components/ui'

const initial = (n) => (n || 'T').slice(0, 1).toUpperCase()

export default function Floor() {
  useTitle('Trading floor')
  const { roster, loading } = usePresence()
  const online = roster.filter((r) => r.isOnline)

  if (loading) return <Card><Loading rows={3} /></Card>

  return (
    <div className="col" style={{ gap: 16 }}>
      <div>
        <h2>Trading floor</h2>
        <div className="small muted">
          Who's at their desk right now. Nobody can see anyone else's trades or P&L —
          only that they're around.
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card stat">
          <div className="label">Online now</div>
          <div className={`value ${online.length > 1 ? 'pos' : ''}`}>{online.length}</div>
          <div className="sub">of {roster.length} trader{roster.length === 1 ? '' : 's'}</div>
        </div>
        <div className="card stat">
          <div className="label">Your desk</div>
          <div className="value">Active</div>
          <div className="sub">this session</div>
        </div>
      </div>

      <Card title="Everyone">
        {roster.length === 0 ? (
          <Empty icon="◌" title="Nobody here yet" />
        ) : (
          <div className="col" style={{ gap: 12 }}>
            {roster.map((p) => {
              const where = pageLabel(p.page)
              return (
                <div className="presence-row" key={p.id}>
                  <span className="avatar-wrap">
                    <span className="avatar">{initial(p.display_name)}</span>
                    <i className={`presence-dot ${p.isOnline ? 'online' : ''}`} />
                  </span>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 650 }}>
                      {p.display_name}
                      {p.isMe && <span className="faint tiny"> · you</span>}
                    </div>
                    <div className="tiny muted">
                      {p.isOnline
                        ? where ? `Active now · on ${where}` : 'Active now'
                        : p.last_seen_at ? `Last seen ${relTime(p.last_seen_at)}` : 'Not seen yet'}
                    </div>
                  </div>
                  {p.isOnline && (
                    <span className="chip" style={{ color: 'var(--pos)', background: 'var(--pos-soft)', borderColor: 'transparent' }}>
                      Online
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {roster.length <= 1 && (
        <div className="small muted">
          Once your trading partner creates an account they'll show up here, and you'll
          see when they're online.
        </div>
      )}
    </div>
  )
}
