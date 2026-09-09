import { startOfWeek, toDateStr, parseDateStr, addDays } from './format'

/** Net P&L implied by prices. Returns null when prices are incomplete. */
export function computePnl({ direction, entry_price, exit_price, quantity, multiplier, fees }) {
  const e = Number(entry_price)
  const x = Number(exit_price)
  if (!Number.isFinite(e) || !Number.isFinite(x) || entry_price === '' || exit_price === '') return null
  const qty = Number(quantity) || 0
  const mult = Number(multiplier) || 1
  const f = Number(fees) || 0
  const dir = direction === 'short' ? -1 : 1
  return (x - e) * dir * qty * mult - f
}

export const sum = (arr, pick = (x) => x) => arr.reduce((a, b) => a + Number(pick(b) || 0), 0)

/** Group trades into { [date]: {date, pnl, trades, wins, losses} } sorted ascending. */
export function byDay(trades) {
  const map = new Map()
  for (const t of trades) {
    const k = t.trade_date
    if (!map.has(k)) map.set(k, { date: k, pnl: 0, trades: 0, wins: 0, losses: 0 })
    const row = map.get(k)
    row.pnl += Number(t.pnl || 0)
    row.trades += 1
    if (Number(t.pnl) > 0) row.wins += 1
    else if (Number(t.pnl) < 0) row.losses += 1
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date))
}

/** Group into Monday-based weeks. */
export function byWeek(trades) {
  const map = new Map()
  for (const t of trades) {
    const k = startOfWeek(t.trade_date)
    if (!map.has(k)) map.set(k, { week: k, pnl: 0, trades: 0, wins: 0 })
    const row = map.get(k)
    row.pnl += Number(t.pnl || 0)
    row.trades += 1
    if (Number(t.pnl) > 0) row.wins += 1
  }
  return [...map.values()].sort((a, b) => a.week.localeCompare(b.week))
}

export function byMonth(trades) {
  const map = new Map()
  for (const t of trades) {
    const k = t.trade_date.slice(0, 7)
    if (!map.has(k)) map.set(k, { month: k, pnl: 0, trades: 0, wins: 0 })
    const row = map.get(k)
    row.pnl += Number(t.pnl || 0)
    row.trades += 1
    if (Number(t.pnl) > 0) row.wins += 1
  }
  return [...map.values()].sort((a, b) => a.month.localeCompare(b.month))
}

/** Core performance stats over a set of trades. */
export function stats(trades) {
  const n = trades.length
  const pnls = trades.map((t) => Number(t.pnl || 0))
  const wins = pnls.filter((p) => p > 0)
  const losses = pnls.filter((p) => p < 0)
  const grossWin = sum(wins)
  const grossLoss = Math.abs(sum(losses))
  const net = sum(pnls)
  const winRate = n ? wins.length / (wins.length + losses.length || 1) : 0
  const avgWin = wins.length ? grossWin / wins.length : 0
  const avgLoss = losses.length ? grossLoss / losses.length : 0
  const expectancy = n ? net / n : 0

  return {
    count: n,
    net,
    wins: wins.length,
    losses: losses.length,
    scratches: n - wins.length - losses.length,
    winRate,
    avgWin,
    avgLoss,
    grossWin,
    grossLoss,
    // profit factor: Infinity when there are wins but no losses at all
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0,
    payoff: avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? Infinity : 0,
    expectancy,
    best: n ? Math.max(...pnls) : 0,
    worst: n ? Math.min(...pnls) : 0,
  }
}

/** Cumulative equity curve, one point per trading day. */
export function equityCurve(trades, startingBalance = 0) {
  let run = Number(startingBalance) || 0
  return byDay(trades).map((d) => {
    run += d.pnl
    return { date: d.date, equity: run, pnl: d.pnl }
  })
}

/** Max peak-to-trough drawdown of the equity curve, in currency. */
export function maxDrawdown(curve) {
  let peak = -Infinity
  let maxDD = 0
  for (const p of curve) {
    if (p.equity > peak) peak = p.equity
    const dd = peak - p.equity
    if (dd > maxDD) maxDD = dd
  }
  return maxDD
}

/** Aggregate stats keyed by an arbitrary field (symbol, account, weekday...). */
export function groupStats(trades, keyFn) {
  const map = new Map()
  for (const t of trades) {
    const keys = keyFn(t)
    for (const k of Array.isArray(keys) ? keys : [keys]) {
      if (k === null || k === undefined || k === '') continue
      if (!map.has(k)) map.set(k, [])
      map.get(k).push(t)
    }
  }
  return [...map.entries()]
    .map(([key, ts]) => ({ key, ...stats(ts) }))
    .sort((a, b) => b.net - a.net)
}

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
export const weekdayOf = (dateStr) => WEEKDAYS[(parseDateStr(dateStr).getDay() + 6) % 7]

/** Dense list of dates between two bounds, inclusive. */
export function dateRange(from, to) {
  const out = []
  let cur = from
  while (cur <= to) {
    out.push(cur)
    cur = addDays(cur, 1)
  }
  return out
}

export { toDateStr, parseDateStr }
