import { useEffect, useState } from 'react'

/**
 * The page-change effect: a lightning crack, a white flash, and a handful
 * of stars streaking across. Mounted with a fresh key on every route
 * change and removed again once it has played, so nothing is left
 * animating or sitting over the page.
 */
const BOLTS = [
  { d: 'M62,0 L44,42 L58,44 L34,100 L46,54 L31,52 Z', left: '18%', delay: '0ms' },
  { d: 'M62,0 L44,42 L58,44 L34,100 L46,54 L31,52 Z', left: '64%', delay: '110ms' },
  { d: 'M62,0 L44,42 L58,44 L34,100 L46,54 L31,52 Z', left: '41%', delay: '58ms' },
]

const STARS = [
  { top: '12%', delay: '0ms', dur: '620ms', len: 190 },
  { top: '27%', delay: '90ms', dur: '520ms', len: 140 },
  { top: '44%', delay: '40ms', dur: '700ms', len: 230 },
  { top: '61%', delay: '160ms', dur: '560ms', len: 160 },
  { top: '78%', delay: '70ms', dur: '660ms', len: 200 },
  { top: '90%', delay: '210ms', dur: '480ms', len: 120 },
]

export default function PageFX() {
  const [alive, setAlive] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setAlive(false), 1100)
    return () => clearTimeout(t)
  }, [])

  if (!alive) return null

  return (
    <div className="pagefx" aria-hidden="true">
      <div className="fx-flash" />

      {BOLTS.map((b, i) => (
        <svg
          key={i}
          className="fx-bolt"
          viewBox="0 0 92 100"
          preserveAspectRatio="none"
          style={{ left: b.left, animationDelay: b.delay }}
        >
          <path d={b.d} />
        </svg>
      ))}

      {STARS.map((s, i) => (
        <span
          key={i}
          className="fx-star"
          style={{
            top: s.top,
            width: s.len,
            animationDelay: s.delay,
            animationDuration: s.dur,
          }}
        />
      ))}
    </div>
  )
}
