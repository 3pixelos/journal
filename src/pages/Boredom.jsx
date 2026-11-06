import { useCallback, useEffect, useRef, useState } from 'react'
import { useTitle } from '../lib/hooks'
import { Card, Empty, Loading } from '../components/ui'
import Avatar from '../components/Avatar'
import { drawCandlestick, drawBomb, stickColor } from '../lib/candlestick'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

/**
 * Candlesticks go up, you swipe, they come down in two pieces.
 *
 * No trade, no money, no balance: the only thing it writes is a score, to
 * the one table in the schema everybody is allowed to read. Your P&L stays
 * yours; a score nobody else can see is not worth keeping.
 *
 * The whole simulation runs in refs and draws to a canvas. Putting a candle
 * in React state would mean a render per frame per candle, and the one thing
 * a game cannot afford is a reconciler between it and the screen.
 */

const GRAVITY = 1150        // px/s², tuned so a candle hangs about two seconds
const SPAWN_MIN = 620       // ms between launches
const SPAWN_MAX = 1450
const TRAIL_MS = 190        // how long the blade mark lingers
const LIVES = 3
const BOMB_CHANCE = 0.16    // of a launch being a bomb, once you are warm
const BOMB_AFTER = 5        // cuts before the first one turns up

const rand = (a, b) => a + Math.random() * (b - a)

function spawn(W, H, bomb = false) {
  const len = bomb ? rand(70, 92) : rand(62, 104)
  const x = rand(W * 0.16, W * 0.84)
  // aim for an apex somewhere in the upper half, then solve for the speed
  // that gets there — picking a velocity directly makes short screens throw
  // candles clean out of the window
  const apex = rand(H * 0.62, H * 0.95)
  return {
    x,
    y: H + len,
    vx: (W / 2 - x) * rand(0.35, 0.75) + rand(-60, 60),
    vy: -Math.sqrt(2 * GRAVITY * apex),
    a: rand(-0.4, 0.4),
    va: rand(-2.6, 2.6),
    len,
    w: len * rand(0.2, 0.3),
    bull: Math.random() < 0.5,
    bomb,
  }
}

/** What a swipe is worth: one is ten, and every extra in the same stroke
 *  lifts the whole stroke. Four at once is worth sixteen singles. */
const comboPoints = (n) => 10 * n * n

/** Distance from a point to the segment p→q: the blade is a line, not a dot. */
function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const l2 = dx * dx + dy * dy
  if (l2 === 0) return Math.hypot(px - ax, py - ay)
  let t = ((px - ax) * dx + (py - ay) * dy) / l2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

export default function Boredom() {
  useTitle('Boredom')

  const canvasRef = useRef(null)
  const game = useRef(null)

  const { user } = useAuth()
  const [score, setScore] = useState(0)
  const [cuts, setCuts] = useState(0)
  const [bestCombo, setBestCombo] = useState(0)
  const [lives, setLives] = useState(LIVES)
  const [endedOn, setEndedOn] = useState('')      // 'misses' | 'bomb'
  const [board, setBoard] = useState(null)        // null until the first load
  const [boardError, setBoardError] = useState('')
  const [over, setOver] = useState(false)
  // Nothing moves until you swipe. Candles that start flying the moment the
  // page loads cost you all three lives while you are still reading the title.
  const [started, setStarted] = useState(false)
  const [best, setBest] = useState(() => {
    try { return Number(localStorage.getItem('tj-boredom-best') || 0) } catch { return 0 }
  })

  const start = useCallback(() => {
    game.current = {
      candles: [], halves: [], sparks: [], trail: [], pops: [],
      nextSpawn: 250, score: 0, cuts: 0, lives: LIVES, bestCombo: 0,
      started: false, over: false,
    }
    setScore(0)
    setCuts(0)
    setBestCombo(0)
    setLives(LIVES)
    setOver(false)
    setStarted(false)
    setEndedOn('')
  }, [])

  useEffect(() => { start() }, [start])

  const loadBoard = useCallback(async () => {
    const { data, error } = await supabase
      .from('boredom_scores')
      .select('user_id, best, best_combo, runs, updated_at')
      .order('best', { ascending: false })
      .limit(20)
    if (error) {
      // The page still plays without the table; only the ranking needs it.
      setBoardError(/does not exist|schema cache/i.test(error.message)
        ? 'Run migration 020 to turn the leaderboard on.'
        : error.message)
      setBoard([])
      return
    }
    const rows = data || []
    const ids = rows.map((r) => r.user_id)
    const { data: profs } = ids.length
      ? await supabase.from('profiles').select('id, display_name, avatar').in('id', ids)
      : { data: [] }
    const by = Object.fromEntries((profs || []).map((p) => [p.id, p]))
    setBoardError('')
    setBoard(rows.map((r) => ({ ...r, who: by[r.user_id] })))
  }, [])

  useEffect(() => { loadBoard() }, [loadBoard])

  /** Called once a run ends. A worse run can never cost you your best: the
   *  greatest() lives in the function, not here. */
  const submit = useCallback(async (finalScore, combo) => {
    if (!finalScore) return
    const { error } = await supabase.rpc('boredom_submit', {
      new_score: finalScore, new_combo: combo,
    })
    if (error) {
      setBoardError(/does not exist|schema cache/i.test(error.message)
        ? 'Run migration 020 to turn the leaderboard on.'
        : error.message)
      return
    }
    loadBoard()
  }, [loadBoard])

  // One way out of a round, whether the bomb got you or the misses did:
  // two copies of this drifted apart the moment bombs arrived.
  const finish = useCallback((reason) => {
    const g = game.current
    if (!g || g.over) return
    g.over = true
    setOver(true)
    setEndedOn(reason)
    setBest((b) => {
      const next = Math.max(b, g.score)
      try { localStorage.setItem('tj-boredom-best', String(next)) } catch { /* private mode */ }
      return next
    })
    submit(g.score, g.bestCombo)
  }, [submit])

  // ---- the loop -------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let raf = 0
    let last = performance.now()
    let W = 0
    let H = 0

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      W = canvas.clientWidth
      H = canvas.clientHeight
      canvas.width = Math.round(W * dpr)
      canvas.height = Math.round(H * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()

    const frame = (now) => {
      raf = requestAnimationFrame(frame)
      const g = game.current
      if (!g) return
      // A backgrounded tab hands back one enormous delta; capping it stops
      // every candle teleporting through the blade on return.
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      const t = now / 1000
      // Checked per frame rather than through an observer: it is two integer
      // comparisons, and it can never be a frame out of date.
      if (canvas.clientWidth !== W || canvas.clientHeight !== H) resize()

      if (g.started && !g.over) {
        g.nextSpawn -= dt * 1000
        if (g.nextSpawn <= 0) {
          const n = Math.random() < 0.22 ? 2 : 1
          for (let i = 0; i < n; i++) {
            // No bombs until you have cut a few: losing on the first throw
            // teaches you nothing except that the page is unfair.
            const bomb = g.cuts >= BOMB_AFTER && Math.random() < BOMB_CHANCE
            g.candles.push(spawn(W, H, bomb))
          }
          g.nextSpawn = rand(SPAWN_MIN, SPAWN_MAX)
        }
      }

      for (const c of [...g.candles, ...g.halves, ...g.sparks]) {
        c.vy += GRAVITY * dt
        c.x += c.vx * dt
        c.y += c.vy * dt
        c.a += c.va * dt
      }

      // a candle that falls back past the bottom uncut costs a life
      const kept = []
      for (const c of g.candles) {
        if (c.y - c.len > H + 60 && c.vy > 0) {
          // Letting a bomb fall is the correct play, so it costs nothing.
          if (!g.over && !c.bomb) {
            g.lives -= 1
            setLives(g.lives)
            if (g.lives <= 0) finish('misses')
          }
          continue
        }
        kept.push(c)
      }
      g.candles = kept
      g.halves = g.halves.filter((h) => h.y - h.len < H + 160)
      g.sparks = g.sparks.filter((s) => (s.life -= dt) > 0)
      g.pops = g.pops.filter((p) => (p.life -= dt) > 0)
      g.trail = g.trail.filter((p) => now - p.t < TRAIL_MS)

      // ---- draw --------------------------------------------------------
      ctx.clearRect(0, 0, W, H)
      for (const h of g.halves) drawCandlestick(ctx, h, h.part)
      for (const c of g.candles) {
        if (c.bomb) drawBomb(ctx, c, t)
        else drawCandlestick(ctx, c, 'whole')
      }

      for (const s of g.sparks) {
        ctx.globalAlpha = Math.max(0, s.life / s.max)
        ctx.fillStyle = s.color
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1

      // combo call-outs, rising and fading where the stroke landed
      for (const p of g.pops) {
        const k = p.life / p.max
        ctx.globalAlpha = Math.min(1, k * 1.6)
        ctx.fillStyle = p.color
        ctx.textAlign = 'center'
        ctx.font = `800 ${p.size}px -apple-system, BlinkMacSystemFont, Inter, sans-serif`
        ctx.fillText(p.text, p.x, p.y - (1 - k) * 46)
      }
      ctx.globalAlpha = 1

      if (g.trail.length > 1) {
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        for (let i = 1; i < g.trail.length; i++) {
          const p = g.trail[i - 1]
          const q = g.trail[i]
          const age = (now - q.t) / TRAIL_MS
          ctx.globalAlpha = Math.max(0, 1 - age) * 0.9
          ctx.lineWidth = 13 * (1 - age) * (i / g.trail.length) + 1.5
          ctx.strokeStyle = '#ffffff'
          ctx.beginPath()
          ctx.moveTo(p.x, p.y)
          ctx.lineTo(q.x, q.y)
          ctx.stroke()
        }
        ctx.globalAlpha = 1
      }
    }
    raf = requestAnimationFrame(frame)

    return () => cancelAnimationFrame(raf)
  }, [])

  // ---- the blade ------------------------------------------------------
  const cut = useCallback((ax, ay, bx, by) => {
    const g = game.current
    if (!g || g.over) return
    const blen = Math.hypot(bx - ax, by - ay)
    if (blen < 6) return        // a tap is not a swipe
    const nx = (bx - ax) / blen
    const ny = (by - ay) / blen

    let hits = 0
    let hitX = 0
    let hitY = 0
    let bombed = false

    g.candles = g.candles.filter((c) => {
      // A bomb is a ball, so it is judged on its radius; a candlestick is
      // long and thin and judged on its length.
      const reach = c.bomb ? c.len * 0.34 : c.len * 0.48
      if (distToSegment(c.x, c.y, ax, ay, bx, by) > reach) return true

      if (c.bomb) {
        bombed = true
        for (let i = 0; i < 26; i++) {
          const life = rand(0.3, 0.75)
          g.sparks.push({
            x: c.x, y: c.y,
            vx: rand(-420, 420), vy: rand(-420, 260),
            a: 0, va: 0, r: rand(1.5, 4.5), life, max: life,
            color: i % 3 ? '#ffb648' : '#ffe9b0',
          })
        }
        return false
      }

      hits += 1
      hitX += c.x
      hitY += c.y

      // Each piece starts a quarter of a candle either side of the cut and
      // leaves along the blade, one each way.
      for (const part of ['top', 'bottom']) {
        const sign = part === 'top' ? 1 : -1
        const off = (part === 'top' ? -1 : 1) * c.len * 0.25
        g.halves.push({
          x: c.x - Math.sin(c.a) * off,
          y: c.y + Math.cos(c.a) * off,
          vx: c.vx + nx * 150 * sign,
          vy: c.vy + ny * 150 * sign - 40,
          a: c.a,
          va: c.va + sign * rand(3, 6),
          len: c.len,
          w: c.w,
          bull: c.bull,
          part,
        })
      }
      for (let i = 0; i < 8; i++) {
        const life = rand(0.25, 0.5)
        g.sparks.push({
          x: c.x, y: c.y,
          vx: rand(-130, 130), vy: rand(-180, 40),
          a: 0, va: 0, r: rand(1, 2.8), life, max: life,
          color: stickColor(c.bull),
        })
      }
      return false
    })

    if (hits) {
      const gained = comboPoints(hits)
      g.score += gained
      g.cuts += hits
      setScore(g.score)
      setCuts(g.cuts)
      if (hits > g.bestCombo) {
        g.bestCombo = hits
        setBestCombo(hits)
      }
      g.pops.push({
        x: hitX / hits,
        y: hitY / hits,
        text: hits > 1 ? `COMBO ×${hits}  +${gained}` : `+${gained}`,
        size: hits > 1 ? 22 + hits * 3 : 17,
        color: hits > 1 ? '#ffd166' : 'rgba(255, 255, 255, 0.85)',
        life: hits > 1 ? 1.1 : 0.7,
        max: hits > 1 ? 1.1 : 0.7,
      })
    }

    // Last, so the points for anything caught in the same stroke still land.
    if (bombed) finish('bomb')
  }, [finish])

  /**
   * The blade is wherever the pointer is going, held down or not — a mouse
   * has to be dragged across the board either way, and holding a button
   * down the whole time is work for no reason. A finger only ever reports
   * movement while it is touching, so touch is unchanged.
   */
  const pointer = useCallback((e) => {
    const g = game.current
    if (!g) return
    const box = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - box.left
    const y = e.clientY - box.top
    const now = performance.now()
    const prev = g.trail[g.trail.length - 1]

    g.trail.push({ x, y, t: now })
    if (g.trail.length > 16) g.trail.shift()

    if (!g.started && !g.over) {
      g.started = true
      setStarted(true)
    }
    // Only join points that arrived one after the other. A pointer that
    // left the board and came back somewhere else would otherwise cut
    // along the line between, taking everything in its path.
    if (prev && now - prev.t < 100) cut(prev.x, prev.y, x, y)
  }, [cut])

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="row-wrap">
        <div>
          <h2>Boredom</h2>
          <div className="small muted">
            Candlesticks go up. Drag through one and it comes down in two
            pieces. None of it touches your P&L — only the score is shared.
          </div>
        </div>
      </div>

      <Card
        title={`${score} points`}
        action={
          <div className="row" style={{ gap: 12, alignItems: 'center' }}>
            <span className="small muted">
              {cuts} cut{bestCombo > 1 ? ` · best ×${bestCombo}` : ''} · best {best}
            </span>
            <span className="lives" aria-label={`${lives} lives left`}>
              {Array.from({ length: LIVES }).map((_, i) => (
                <i key={i} className={i < lives ? 'on' : ''} />
              ))}
            </span>
            <button className="btn-ghost btn-sm" onClick={start}>Restart</button>
          </div>
        }
      >
        <div className="stage">
          <canvas
            ref={canvasRef}
            onPointerDown={(e) => {
              // Capture keeps a finger's stroke alive past the edge of the
              // board; some browsers refuse an id they do not consider active.
              try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* no capture */ }
              game.current.trail = []
              pointer(e)
            }}
            onPointerMove={pointer}
            onPointerEnter={() => { game.current.trail = [] }}
            onPointerLeave={() => { game.current.trail = [] }}
          />

          {(over || !started) && (
            <div className={`stage-over ${over ? '' : 'waiting'}`}>
              {over ? (
                <>
                  <div className="big">{score}</div>
                  <div className="small muted">
                    {endedOn === 'bomb' ? '💥 You cut a bomb. ' : ''}
                    {cuts} cut{bestCombo > 1 ? `, best combo ×${bestCombo}` : ''}
                    {score >= best && score > 0 ? ' — your best yet.' : `. Best ${best}.`}
                  </div>
                  <button className="btn-go" onClick={start}>Again</button>
                </>
              ) : (
                <>
                  <div className="big">Swipe to start</div>
                  <div className="small muted">
                    Move across the board. The blade cuts whatever it crosses —
                    no need to hold anything down.
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        <div className="tiny faint" style={{ marginTop: 10 }}>
          One candlestick is 10. Two in the same stroke is 40, three is 90 —
          the whole stroke is worth more, not just the extra one. Three misses
          and it stops, and <strong>cutting a bomb ends it there</strong>;
          letting one fall costs nothing.
        </div>
      </Card>

      <Card title="Leaderboard">
        {boardError && <div className="small muted" style={{ marginBottom: 10 }}>{boardError}</div>}
        {board === null ? (
          <Loading rows={3} />
        ) : board.length === 0 ? (
          <Empty icon="▮" title="Nobody has played yet"
                 hint="Finish a run and your score lands here." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th style={{ width: 44 }} /><th>Player</th>
                    <th className="right">Best combo</th><th className="right">Runs</th>
                    <th className="right">Score</th></tr>
              </thead>
              <tbody>
                {board.map((row, i) => (
                  <tr key={row.user_id} className={row.user_id === user?.id ? 'me' : ''}>
                    <td className="mono faint">{i + 1}</td>
                    <td>
                      <span className="row" style={{ gap: 8, alignItems: 'center' }}>
                        <Avatar name={row.who?.display_name || 'Trader'} avatar={row.who?.avatar} />
                        <span style={{ fontWeight: 650 }}>
                          {row.who?.display_name || 'Someone'}
                          {row.user_id === user?.id && <span className="faint small"> · you</span>}
                        </span>
                      </span>
                    </td>
                    <td className="right mono small muted">
                      {row.best_combo > 1 ? `×${row.best_combo}` : '—'}
                    </td>
                    <td className="right mono small muted">{row.runs}</td>
                    <td className="right mono" style={{ fontWeight: 750 }}>{row.best}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
