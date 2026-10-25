/**
 * Ambient background. Three very slow blurred orbs drifting behind a faint
 * grid and a film of grain — enough to stop the black reading as flat, far
 * too slow to notice while you are reading a number off a card.
 *
 * Pure CSS transforms on three elements, so it costs the compositor almost
 * nothing and never touches layout. Hidden entirely under reduced motion.
 */
export default function Backdrop() {
  return (
    <div className="backdrop" aria-hidden="true">
      <div className="orb orb-a" />
      <div className="orb orb-b" />
      <div className="orb orb-c" />
      <div className="grid-veil" />
      <div className="grain" />
    </div>
  )
}
