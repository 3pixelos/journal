import { useEffect, useState } from 'react'

/**
 * The effect that plays when you arrive at a page — a different one per
 * route, because the same lightning everywhere stopped reading as a
 * transition and started reading as a tic.
 *
 * Mounted with a fresh key on each navigation and removed once it has
 * played, so nothing is left animating over the page.
 */
const BOLT = 'M62,0 L44,42 L58,44 L34,100 L46,54 L31,52 Z'

export const FX_FOR = {
  '/': 'storm',
  '/trades': 'scan',
  '/journal': 'shutter',
  '/backtesting': 'rain',
  '/reminders': 'ripple',
  '/settings': 'dim',
}

export default function PageFX({ variant = 'storm' }) {
  const [alive, setAlive] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setAlive(false), 1200)
    return () => clearTimeout(t)
  }, [])

  if (!alive) return null

  return (
    <div className={`pagefx fx-${variant}`} aria-hidden="true">
      {variant === 'storm' && (
        <>
          <div className="fx-flash" />
          {[['18%', '0ms'], ['64%', '110ms'], ['41%', '58ms']].map(([left, delay]) => (
            <svg key={left} className="fx-bolt" viewBox="0 0 92 100" preserveAspectRatio="none"
                 style={{ left, animationDelay: delay }}>
              <path d={BOLT} />
            </svg>
          ))}
          {[['12%', '0ms', '620ms', 190], ['27%', '90ms', '520ms', 140],
            ['44%', '40ms', '700ms', 230], ['61%', '160ms', '560ms', 160],
            ['78%', '70ms', '660ms', 200], ['90%', '210ms', '480ms', 120],
          ].map(([top, delay, dur, len]) => (
            <span key={top} className="fx-star"
                  style={{ top, width: len, animationDelay: delay, animationDuration: dur }} />
          ))}
        </>
      )}

      {/* Trades — a scanner sweeps the ledger */}
      {variant === 'scan' && (
        <>
          <div className="fx-scanline" />
          <div className="fx-scangrid" />
        </>
      )}

      {/* Journal — a camera shutter, since the page is made of photographs */}
      {variant === 'shutter' && (
        <>
          <div className="fx-blade top" />
          <div className="fx-blade bottom" />
          <div className="fx-pop" />
        </>
      )}

      {/* Backtesting — numbers falling through */}
      {variant === 'rain' && (
        <>
          {Array.from({ length: 22 }).map((_, i) => (
            <span key={i} className="fx-drop"
                  style={{
                    left: `${(i * 4.6 + (i % 3) * 1.7) % 100}%`,
                    height: 60 + ((i * 37) % 120),
                    animationDelay: `${(i % 7) * 55}ms`,
                    animationDuration: `${520 + ((i * 53) % 320)}ms`,
                  }} />
          ))}
        </>
      )}

      {/* Reminders — rings, like something landing */}
      {variant === 'ripple' && (
        <>
          <div className="fx-ring" />
          <div className="fx-ring r2" />
          <div className="fx-ring r3" />
        </>
      )}

      {/* Settings — just the lights dipping */}
      {variant === 'dim' && <div className="fx-fade" />}
    </div>
  )
}
