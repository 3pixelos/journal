/**
 * Drawing one candlestick, or one piece of one.
 *
 * Split out from the page so it can be called against a canvas on its own:
 * a renderer you cannot draw a single frame of in isolation is a renderer
 * whose bugs only show up as "it looks wrong" at sixty frames a second.
 *
 * A half is drawn by clipping to its share of the candle and then drawing
 * the whole thing — so the wick, the body and the colours of a piece are by
 * construction the ones it had before the blade went through it.
 */

const UP = '#2bc77d'
const DOWN = '#ef4b4b'

function body(ctx, w, len, bull) {
  const col = bull ? UP : DOWN
  const h = len * 0.56

  ctx.strokeStyle = col
  ctx.lineWidth = Math.max(1.6, w * 0.17)
  ctx.lineCap = 'butt'
  ctx.beginPath()
  ctx.moveTo(0, -len / 2)
  ctx.lineTo(0, len / 2)
  ctx.stroke()

  const grad = ctx.createLinearGradient(-w / 2, 0, w / 2, 0)
  grad.addColorStop(0, col)
  grad.addColorStop(0.4, bull ? '#56e39b' : '#ff7070')
  grad.addColorStop(1, col)
  ctx.fillStyle = grad
  ctx.strokeStyle = 'rgba(8, 12, 18, 0.35)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.roundRect(-w / 2, -h / 2, w, h, w * 0.16)
  ctx.fill()
  ctx.stroke()
}

/**
 * @param part 'whole', or which half of a cut candle this piece is.
 * A piece's own (x, y) is its centre, so the original candle's centre sits a
 * quarter of a length the other way — that offset is what lines the wick of
 * a falling half back up with where it was cut from.
 */
export function drawCandlestick(ctx, c, part = 'whole') {
  ctx.save()
  ctx.translate(c.x, c.y)
  ctx.rotate(c.a)

  if (part !== 'whole') {
    const top = part === 'top'
    ctx.translate(0, top ? c.len / 4 : -c.len / 4)
    ctx.beginPath()
    ctx.rect(-c.w, top ? -c.len / 2 - 1 : 0, c.w * 2, c.len / 2 + 1)
    ctx.clip()
  }

  body(ctx, c.w, c.len, c.bull)

  if (part !== 'whole') {
    // the cut, drawn inside the clip so it lands exactly on the open end
    ctx.strokeStyle = 'rgba(10, 14, 20, 0.55)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(-c.w / 2, 0)
    ctx.lineTo(c.w / 2, 0)
    ctx.stroke()
  }
  ctx.restore()
}

export const stickColor = (bull) => (bull ? UP : DOWN)

/**
 * A bomb. Drawn from the same call site as a candlestick, so the loop does
 * not have to care which one it is holding.
 *
 * The fuse spark is tied to the clock rather than to the bomb, so a screen
 * with three of them does not have three sparks blinking in lockstep.
 */
export function drawBomb(ctx, b, t) {
  const r = b.len * 0.3
  ctx.save()
  ctx.translate(b.x, b.y)
  ctx.rotate(b.a)

  const shell = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r)
  shell.addColorStop(0, '#5a606b')
  shell.addColorStop(0.55, '#262a31')
  shell.addColorStop(1, '#0d0f13')
  ctx.fillStyle = shell
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)'
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.arc(-r * 0.3, -r * 0.34, r * 0.3, Math.PI * 0.9, Math.PI * 1.7)
  ctx.stroke()

  // cap and fuse
  ctx.fillStyle = '#3b414b'
  ctx.beginPath()
  ctx.roundRect(-r * 0.28, -r * 1.22, r * 0.56, r * 0.4, r * 0.1)
  ctx.fill()

  ctx.strokeStyle = '#8a7a5c'
  ctx.lineWidth = Math.max(1.6, r * 0.12)
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(0, -r * 1.2)
  ctx.quadraticCurveTo(r * 0.5, -r * 1.7, r * 0.75, -r * 1.35)
  ctx.stroke()

  const spark = 1 + Math.sin(t * 19) * 0.3
  const glow = ctx.createRadialGradient(r * 0.75, -r * 1.35, 0, r * 0.75, -r * 1.35, r * 0.6 * spark)
  glow.addColorStop(0, '#fffbe8')
  glow.addColorStop(0.4, '#ffb648')
  glow.addColorStop(1, 'rgba(255, 140, 40, 0)')
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(r * 0.75, -r * 1.35, r * 0.55 * spark, 0, Math.PI * 2)
  ctx.fill()

  ctx.restore()
}
