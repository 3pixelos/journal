import { useEffect } from 'react'
import { createPortal } from 'react-dom'

/**
 * The moment you mark a result. Green shockwave and VICTORY for a win,
 * red and TAKE THE LESSON for a loss. Portalled to body so nothing on the
 * page can clip it, and it removes itself when it has played.
 */
const RAYS = Array.from({ length: 14 }, (_, i) => i * (360 / 14))

export default function Celebrate({ kind, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1500)
    return () => clearTimeout(t)
  }, [onDone])

  const win = kind === 'win'

  return createPortal(
    <div className={`celebrate ${win ? 'win' : 'loss'}`} aria-hidden="true">
      <div className="cb-wash" />
      <div className="cb-ring" />
      <div className="cb-ring cb-ring-2" />
      <div className="cb-rays">
        {RAYS.map((deg) => (
          <i key={deg} style={{ transform: `rotate(${deg}deg)`, animationDelay: `${deg / 1400}s` }} />
        ))}
      </div>
      <div className="cb-word">
        <span>{win ? 'VICTORY' : 'TAKE THE LESSON'}</span>
        <small>{win ? 'that is how it is done' : 'log it, learn it, move on'}</small>
      </div>
    </div>,
    document.body
  )
}
