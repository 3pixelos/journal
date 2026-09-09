/**
 * Generated avatars: a gradient plus an optional pattern overlay, with the
 * person's initial on top. Picked from a fixed set, so there is nothing to
 * upload, store or moderate — and they render instantly anywhere.
 */
export const AVATARS = [
  { id: 'mono',   name: 'Mono',    from: '#f5f5f5', to: '#8b8b8b', fg: '#111', pattern: 'plain' },
  { id: 'ember',  name: 'Ember',   from: '#ff8a3d', to: '#f4265f', fg: '#fff', pattern: 'glow' },
  { id: 'aurora', name: 'Aurora',  from: '#22d3ee', to: '#4f46e5', fg: '#fff', pattern: 'conic' },
  { id: 'lime',   name: 'Lime',    from: '#bef264', to: '#15803d', fg: '#08240f', pattern: 'plain' },
  { id: 'violet', name: 'Violet',  from: '#c4b5fd', to: '#6d28d9', fg: '#fff', pattern: 'dots' },
  { id: 'sunset', name: 'Sunset',  from: '#fcd34d', to: '#ea580c', fg: '#3b1503', pattern: 'glow' },
  { id: 'ocean',  name: 'Ocean',   from: '#5eead4', to: '#0369a1', fg: '#fff', pattern: 'stripes' },
  { id: 'rose',   name: 'Rose',    from: '#fda4af', to: '#be123c', fg: '#fff', pattern: 'plain' },
  { id: 'mint',   name: 'Mint',    from: '#6ee7b7', to: '#047857', fg: '#022c1d', pattern: 'dots' },
  { id: 'gold',   name: 'Gold',    from: '#fde68a', to: '#a16207', fg: '#2b1a02', pattern: 'conic' },
  { id: 'neon',   name: 'Neon',    from: '#f0abfc', to: '#0891b2', fg: '#fff', pattern: 'glow' },
  { id: 'magma',  name: 'Magma',   from: '#fb7185', to: '#7c2d12', fg: '#fff', pattern: 'stripes' },
  { id: 'ice',    name: 'Ice',     from: '#e0f2fe', to: '#475569', fg: '#0b1622', pattern: 'plain' },
  { id: 'carbon', name: 'Carbon',  from: '#4b5563', to: '#0b0d10', fg: '#fff', pattern: 'stripes' },
]

const OVERLAY = {
  plain: 'none',
  glow: 'radial-gradient(circle at 30% 22%, rgba(255,255,255,0.55), transparent 58%)',
  dots: 'radial-gradient(rgba(255,255,255,0.4) 1.1px, transparent 1.2px)',
  stripes:
    'repeating-linear-gradient(135deg, rgba(255,255,255,0.16) 0 3px, transparent 3px 7px)',
  conic:
    'conic-gradient(from 210deg, rgba(255,255,255,0.35), transparent 42%, rgba(0,0,0,0.22) 78%, transparent)',
}

export const getAvatar = (id) => AVATARS.find((a) => a.id === id) || AVATARS[0]

/** Inline style for an avatar of the given preset. */
export function avatarStyle(id) {
  const a = getAvatar(id)
  const overlay = OVERLAY[a.pattern] || 'none'
  const base = `linear-gradient(145deg, ${a.from}, ${a.to})`
  return {
    backgroundImage: overlay === 'none' ? base : `${overlay}, ${base}`,
    backgroundSize: a.pattern === 'dots' ? '7px 7px, cover' : 'cover',
    color: a.fg,
  }
}
