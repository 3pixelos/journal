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

/**
 * Turn a planned stop and target in points into dollars.
 *
 * risk    = stop points   x $/point x contracts
 * reward  = target points x $/point x contracts
 *
 * The realised P&L follows `result`: hitting the target pays the reward,
 * hitting the stop costs the risk, and a manual close uses whatever amount
 * was typed. Fees come off every outcome.
 */
export function sizeTrade({
  contract, qty, stopPoints, targetPoints, result, fees, manualPnl, balance,
}) {
  const pp = perPoint(contract)
  const contracts = Math.max(n(qty), 0)
  const stop = Math.abs(n(stopPoints))
  const target = Math.abs(n(targetPoints))
  const cost = n(fees)

  const risk = stop * pp * contracts
  const reward = target * pp * contracts

  let gross = 0
  if (result === 'target') gross = reward
  else if (result === 'stop') gross = -risk
  else if (result === 'manual') gross = n(manualPnl)

  const pnl = result ? gross - cost : 0
  const startBalance = balance === '' || balance == null ? null : n(balance)

  return {
    perPoint: pp,
    risk,
    reward,
    rr: risk > 0 ? reward / risk : 0,
    pnl,
    // what the account looks like before and after, when a balance was given
    startBalance,
    endBalance: startBalance == null ? null : startBalance + pnl,
    riskPct: startBalance > 0 ? risk / startBalance : 0,
    complete: Boolean(contract && contracts > 0 && result),
  }
}

export const EXECUTIONS = [
  { value: 'followed', label: 'Followed the plan', tone: 'pos',
    hint: 'Waited for every confluence and took it exactly as planned.' },
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
