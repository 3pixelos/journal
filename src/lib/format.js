// ---- money / numbers -------------------------------------------------
export const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US dollar' },
  { code: 'GBP', symbol: '£', name: 'Pound sterling' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian dollar' },
]

/**
 * What the account is denominated in. Set once from settings so the
 * hundreds of money() calls across the app do not each need telling —
 * pass { currency } explicitly only for contract figures, which are USD
 * whatever the account happens to be.
 */
let displayCurrency = 'USD'
export const setDisplayCurrency = (c) => { displayCurrency = c || 'USD' }
export const getDisplayCurrency = () => displayCurrency

export function money(n, { sign = false, decimals = 2, currency } = {}) {
  const v = Number(n || 0)
  const s = v.toLocaleString('en-US', {
    style: 'currency',
    currency: currency || displayCurrency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  return sign && v > 0 ? `+${s}` : s
}

/** Contract P&L is always USD, regardless of the account. */
export const usd = (n, opts = {}) => money(n, { ...opts, currency: 'USD' })

export function num(n, decimals = 2) {
  const v = Number(n || 0)
  return v.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

export function pct(n, decimals = 1) {
  return `${(Number(n || 0) * 100).toFixed(decimals)}%`
}

export const pnlClass = (n) => (Number(n) > 0 ? 'pos' : Number(n) < 0 ? 'neg' : 'flat')

// ---- dates (all local-time, no UTC drift) ----------------------------
export function toDateStr(d = new Date()) {
  const dt = typeof d === 'string' ? parseDateStr(d) : d
  const p = (x) => String(x).padStart(2, '0')
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`
}

export function parseDateStr(s) {
  if (s instanceof Date) return s
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const todayStr = () => toDateStr(new Date())

export function addDays(dateStr, n) {
  const d = parseDateStr(dateStr)
  d.setDate(d.getDate() + n)
  return toDateStr(d)
}

/** Monday-based start of the week containing dateStr. */
export function startOfWeek(dateStr = todayStr()) {
  const d = parseDateStr(dateStr)
  const dow = (d.getDay() + 6) % 7 // Mon=0 ... Sun=6
  d.setDate(d.getDate() - dow)
  return toDateStr(d)
}

export const endOfWeek = (dateStr = todayStr()) => addDays(startOfWeek(dateStr), 6)

export function startOfMonth(dateStr = todayStr()) {
  const d = parseDateStr(dateStr)
  return toDateStr(new Date(d.getFullYear(), d.getMonth(), 1))
}

/** '2026-09-08' -> 'Mon 8 Sep' */
export function shortDate(s) {
  const d = parseDateStr(s)
  return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })
}

/** '2026-09-08' -> 'Sep 8' */
export function tinyDate(s) {
  const d = parseDateStr(s)
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
}

export function longDate(s) {
  const d = parseDateStr(s)
  return d.toLocaleDateString('en-US', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

export function relTime(iso) {
  if (!iso) return ''
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
}

/** ISO week label, e.g. 'W37 · Sep 8'. */
export function weekLabel(weekStart) {
  return tinyDate(weekStart)
}
