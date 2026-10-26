/**
 * Whether animations run.
 *
 * The OS "reduce motion" setting silently disabled every animation in the
 * app, which is indistinguishable from the animations being broken. The
 * effective state is resolved here once and written to the document as
 * data-motion, so the stylesheet only has to check one thing — and it can
 * be overridden, because this is a personal tool and the owner asked for
 * the motion.
 */
const KEY = 'tj-motion'

export const MOTION_OPTIONS = [
  { value: 'full', label: 'Full', hint: 'Always animate, whatever the system says.' },
  { value: 'system', label: 'System', hint: 'Follow the OS reduce-motion setting.' },
  { value: 'off', label: 'Off', hint: 'No animation anywhere.' },
]

export function getMotionPref() {
  try { return localStorage.getItem(KEY) || 'full' } catch { return 'full' }
}

export function systemPrefersReduced() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}

/** Resolve the preference against the OS and stamp the result on <html>. */
export function applyMotion(pref = getMotionPref()) {
  const on = pref === 'full' ? true
    : pref === 'off' ? false
    : !systemPrefersReduced()
  document.documentElement.dataset.motion = on ? 'on' : 'off'
  return on
}

export function setMotionPref(pref) {
  try { localStorage.setItem(KEY, pref) } catch { /* private mode */ }
  return applyMotion(pref)
}
