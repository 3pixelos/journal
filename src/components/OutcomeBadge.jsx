export const OUTCOMES = [
  { value: 'win', label: 'Win' },
  { value: 'loss', label: 'Loss' },
  { value: 'breakeven', label: 'Breakeven' },
]

/** Win / loss / breakeven label. Says how it went, never how much. */
export default function OutcomeBadge({ outcome }) {
  if (!outcome) return null
  const win = outcome === 'win'
  const loss = outcome === 'loss'
  return (
    <span
      className="chip"
      style={{
        color: win ? 'var(--pos)' : loss ? 'var(--neg)' : 'var(--muted)',
        background: win ? 'var(--pos-soft)' : loss ? 'var(--neg-soft)' : 'var(--panel-2)',
        borderColor: 'transparent',
        fontWeight: 700,
      }}
    >
      {win ? 'Win' : loss ? 'Loss' : 'B/E'}
    </span>
  )
}
