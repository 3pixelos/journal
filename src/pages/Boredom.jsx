import { useCallback, useEffect, useRef, useState } from 'react'
import { useTitle } from '../lib/hooks'
import { Card } from '../components/ui'
import { drawCandlestick, stickColor } from '../lib/candlestick'

/**
 * Candlesticks go up, you swipe, they come down in two pieces.
 *
 * Nothing here touches Supabase: no trade, no money, no row. The best score
 * lives in localStorage, because losing it costs nothing and a table for it
 * would be the silliest thing in the schema.
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

const rand = (a, b) => a + Math.random() * (b - a)

function spawn(W, H) {
  const len = rand(62, 104)
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
  }
}

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

  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(LIVES)
  const [over, setOver] = useState(false)
  // Nothing moves until you swipe. Candles that start flying the moment the
  // page loads cost you all three lives while you are still reading the title.
  const [started, setStarted] = useState(false)
  const [best, setBest] = useState(() => {
    try { return Number(localStorage.getItem('tj-boredom-best') || 0) } catch { return 0 }
  })

  const start = useCallback(() => {
    game.current = {
      candles: [], halves: [], sparks: [], trail: [],
      nextSpawn: 250, score: 0, lives: LIVES,
      started: false, over: false,
    }
    setScore(0)
    setLives(LIVES)
    setOver(false)
    setStarted(false)
  }, [])

  useEffect(() => { start() }, [start])

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
          for (let i = 0; i < n; i++) g.candles.push(spawn(W, H))
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
          if (!g.over) {
            g.lives -= 1
            setLives(g.lives)
            if (g.lives <= 0) {
              g.over = true
              setOver(true)
              setBest((b) => {
                const next = Math.max(b, g.score)
                try { localStorage.setItem('tj-boredom-best', String(next)) } catch { /* private mode */ }
                return next
              })
            }
          }
          continue
        }
        kept.push(c)
      }
      g.candles = kept
      g.halves = g.halves.filter((h) => h.y - h.len < H + 160)
      g.sparks = g.sparks.filter((s) => (s.life -= dt) > 0)
      g.trail = g.trail.filter((p) => now - p.t < TRAIL_MS)

      // ---- draw --------------------------------------------------------
      ctx.clearRect(0, 0, W, H)
      for (const h of g.halves) drawCandlestick(ctx, h, h.part)
      for (const c of g.candles) drawCandlestick(ctx, c, 'whole')

      for (const s of g.sparks) {
        ctx.globalAlpha = Math.max(0, s.life / s.max)
        ctx.fillStyle = s.color
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fill()
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
    g.candles = g.candles.filter((c) => {
      if (distToSegment(c.x, c.y, ax, ay, bx, by) > c.len * 0.48) return true
      hits += 1

      // the two pieces leave along the blade, one each way
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
      g.score += hits
      setScore(g.score)
    }
  }, [])

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
            pieces. Nothing here counts towards anything.
          </div>
        </div>
      </div>

      <Card
        title={`Score ${score}`}
        action={
          <div className="row" style={{ gap: 12, alignItems: 'center' }}>
            <span className="small muted">Best {best}</span>
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
                  <div className="big">{score} cut</div>
                  <div className="small muted">
                    {score >= best && score > 0 ? 'Your best yet.' : `Best ${best}.`}
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
          Drag across a candlestick to cut it — a tap will not do it, the
          blade has to travel. Three misses and it stops.
        </div>
      </Card>
    </div>
  )
}
