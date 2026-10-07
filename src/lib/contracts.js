/**
 * Index futures the journal knows how to size.
 * `perPoint` is dollars of P&L per one point of price movement, per contract.
 */
export const CONTRACTS = [
  { id: 'NQ', name: 'NQ', full: 'E-mini Nasdaq 100', perPoint: 20 },
  { id: 'MNQ', name: 'MNQ', full: 'Micro E-mini Nasdaq 100', perPoint: 2 },
]

export const getContract = (id) => CONTRACTS.find((c) => c.id === id) || null
export const perPoint = (id) => getContract(id)?.perPoint ?? 0

export const RESULTS = [
  { value: 'target', label: 'Hit target' },
  { value: 'stop', label: 'Hit stop' },
  { value: 'manual', label: 'Closed manually' },
]

const n = (v) => {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}

const given = (v) => v !== '' && v !== null && v !== undefined && Number.isFinite(Number(v))

/**
 * Work a trade out from the prices you actually saw on the chart.
 *
 * You give entry, stop and target as prices. Direction falls out of them —
 * a target above entry is a long, below is a short — and the point distances
 * follow, which is what the dollar maths needs:
 *
 *   risk   = |entry - stop|   x $/point x contracts
 *   reward = |target - entry| x $/point x contracts
 *
 * Hitting the target pays the reward, hitting the stop costs the risk, and a
 * manual close is priced off wherever you actually got out. Fees come off
 * every outcome.
 */
export function sizeTrade({
  contract, qty, entryPrice, stopPrice, targetPrice, exitPrice,
  result, fees, balance,
}) {
  const pp = perPoint(contract)
  const contracts = Math.max(n(qty), 0)
  const cost = n(fees)
  const dollarsPerPoint = pp * contracts

  const hasEntry = given(entryPrice)
  const entry = n(entryPrice)
  const stop = n(stopPrice)
  const target = n(targetPrice)

  // Direction comes from the levels themselves: target above entry is a long.
  let dir = null
  if (hasEntry && given(targetPrice) && target !== entry) dir = target > entry ? 'long' : 'short'
  else if (hasEntry && given(stopPrice) && stop !== entry) dir = stop < entry ? 'long' : 'short'
  const sign = dir === 'short' ? -1 : 1

  const stopPoints = hasEntry && given(stopPrice) ? Math.abs(entry - stop) : 0
  const targetPoints = hasEntry && given(targetPrice) ? Math.abs(target - entry) : 0

  const risk = stopPoints * dollarsPerPoint
  const reward = targetPoints * dollarsPerPoint

  // Where the trade actually ended, so P&L and the record agree.
  let exit = null
  if (result === 'target' && given(targetPrice)) exit = target
  else if (result === 'stop' && given(stopPrice)) exit = stop
  else if (result === 'manual' && given(exitPrice)) exit = n(exitPrice)

  let gross = 0
  if (result === 'target') gross = reward
  else if (result === 'stop') gross = -risk
  else if (result === 'manual' && exit != null && hasEntry) {
    gross = (exit - entry) * sign * dollarsPerPoint
  }

  const pnl = result ? gross - cost : 0
  const startBalance = given(balance) ? n(balance) : null

  // Levels on the wrong side of entry are almost always a typo.
  let warning = null
  if (hasEntry && dir && given(stopPrice)) {
    const stopWrong = dir === 'long' ? stop > entry : stop < entry
    if (stopWrong) {
      warning = `For a ${dir}, the stop should be ${dir === 'long' ? 'below' : 'above'} your entry.`
    } else if (stop === entry) {
      warning = 'Your stop is at your entry, so there is no risk to size.'
    }
  }

  const complete = Boolean(
    contract && contracts > 0 && hasEntry && result
    && (result !== 'manual' || exit != null)
    && (result !== 'target' || given(targetPrice))
    && (result !== 'stop' || given(stopPrice))
  )

  return {
    perPoint: pp, dollarsPerPoint, dir,
    stopPoints, targetPoints,
    risk, reward,
    rr: risk > 0 ? reward / risk : 0,
    exitPoints: exit != null && hasEntry ? Math.abs(exit - entry) : 0,
    exit,
    pnl,
    startBalance,
    endBalance: startBalance == null ? null : startBalance + pnl,
    riskPct: startBalance > 0 ? risk / startBalance : 0,
    warning,
    complete,
  }
}

export const EXECUTIONS = [
  { value: 'followed', label: 'Followed the plan', tone: 'pos',
    hint: 'Followed every step and took it exactly as planned.' },
  { value: 'early', label: 'Entered early', tone: 'neg',
    hint: 'Jumped in before the setup completed.' },
  { value: 'late', label: 'Entered late', tone: 'neg',
    hint: 'Chased it after the move had started.' },
  { value: 'deviated', label: 'Deviated mid-trade', tone: 'neg',
    hint: 'Moved the stop, cut early, or added size off-plan.' },
  { value: 'no_plan', label: 'No plan at all', tone: 'neg',
    hint: 'Took it on impulse.' },
]

export const getExecution = (v) => EXECUTIONS.find((e) => e.value === v) || null
