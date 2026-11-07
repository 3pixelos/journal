import { avatarStyle, isUploaded } from '../lib/avatars'
import { useAvatarUrl } from '../lib/hooks'

/**
 * Someone's picture: their own upload if they have one, otherwise the preset
 * they chose, with their initial on top.
 *
 * The initial stays underneath an uploaded picture rather than being removed,
 * so a face that is still loading — or one whose signed link has gone stale —
 * shows who it belongs to instead of an empty circle.
 */
export default function Avatar({ name, avatar, size = 'md', online, dot = false }) {
  const initial = (name || 'T').trim().slice(0, 1).toUpperCase()
  const url = useAvatarUrl(avatar)
  const uploaded = isUploaded(avatar)

  const el = (
    <span
      className={`avatar av-${size} ${uploaded ? 'av-photo' : ''}`}
      style={uploaded ? undefined : avatarStyle(avatar)}
      aria-hidden="true"
    >
      {initial}
      {url && <img src={url} alt="" />}
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
