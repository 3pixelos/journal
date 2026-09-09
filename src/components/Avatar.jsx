import { avatarStyle } from '../lib/avatars'

/** Someone's picture: their chosen preset, with their initial on top. */
export default function Avatar({ name, avatar, size = 'md', online, dot = false }) {
  const initial = (name || 'T').trim().slice(0, 1).toUpperCase()
  const el = (
    <span className={`avatar av-${size}`} style={avatarStyle(avatar)} aria-hidden="true">
      {initial}
    </span>
  )
  if (!dot) return el
  return (
    <span className="avatar-wrap">
      {el}
      <i className={`presence-dot ${online ? 'online' : ''}`} />
    </span>
  )
}
