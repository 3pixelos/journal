/**
 * What everyone's record looks like, read from the shared journal.
 *
 * Deliberately not from `trades`: those are private, and nobody can see
 * anyone else's. The journal is the one surface people share, so it is the
 * only honest basis for a record other people are shown — and it means the
 * number on your own card is the same number your partner sees.
 */

/** Days you stood aside are not wins and not losses, so they count in the
 *  total and nowhere else. */
const played = (e) => e.outcome === 'win' || e.outcome === 'loss'

/**
 * Consecutive wins, counting back from the most recent entry.
 *
 * A day you passed on does not break it — standing aside is not a loss, and
 * a streak that dies because you were disciplined on a Tuesday is a streak
 * that punishes the right call.
 */
function streakOf(sorted) {
  let n = 0
  for (const e of sorted) {
    if (e.outcome === 'win') n += 1
    else if (e.outcome === 'loss') break
  }
  return n
}

/** The longest run of wins anywhere in the record. */
function bestStreakOf(sorted) {
  let best = 0
  let run = 0
  for (const e of sorted) {
    if (e.outcome === 'win') { run += 1; best = Math.max(best, run) }
    else if (e.outcome === 'loss') run = 0
  }
  return best
}

/**
 * Group shared journal entries by author.
 *
 * @param entries rows of { user_id, outcome, entry_date }
 * @returns { [userId]: { entries, wins, losses, aside, winRate, streak, best, last } }
 */
export function floorStats(entries) {
  const by = {}
  for (const e of entries) (by[e.user_id] ||= []).push(e)

  const out = {}
  for (const [userId, rows] of Object.entries(by)) {
    // newest first: a current streak is counted backwards from today
    const sorted = [...rows].sort((a, b) => (a.entry_date < b.entry_date ? 1 : -1))
    const wins = sorted.filter((e) => e.outcome === 'win').length
    const losses = sorted.filter((e) => e.outcome === 'loss').length
    const decided = wins + losses
    out[userId] = {
      entries: sorted.length,
      wins,
      losses,
      aside: sorted.filter((e) => e.outcome === 'no_trade').length,
      unmarked: sorted.filter((e) => !played(e) && e.outcome !== 'no_trade').length,
      winRate: decided ? wins / decided : 0,
      decided,
      streak: streakOf(sorted),
      best: bestStreakOf(sorted),
      last: sorted[0]?.entry_date || null,
    }
  }
  return out
}

/** Nothing logged yet, in the shape the card expects. */
export const EMPTY_STATS = {
  entries: 0, wins: 0, losses: 0, aside: 0, unmarked: 0,
  winRate: 0, decided: 0, streak: 0, best: 0, last: null,
}
