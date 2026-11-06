/**
 * Drawing one candle, or one piece of one.
 *
 * Split out from the page so it can be called against a canvas on its own:
 * the flame spent its first life painted at the candle's midpoint, under the
 * wax, and that is only obvious if you can draw a candle and look at it.
 */
function drawFlame(ctx, w, t, seed) {
  const flicker = 1 + Math.sin(t * 11 + seed) * 0.14
  const h = w * 1.5 * flicker
  const grad = ctx.createRadialGradient(0, -h * 0.35, 0, 0, -h * 0.3, h)
  grad.addColorStop(0, '#fff6d8')
  grad.addColorStop(0.45, '#ffc866')
  grad.addColorStop(1, 'rgba(255, 150, 40, 0)')
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.ellipse(0, -h * 0.34, w * 0.42, h * 0.58, 0, 0, Math.PI * 2)
  ctx.fill()
}

/**
 * One candle, or one piece of one. `part` says which end we are drawing, so a
 * top half keeps its flame and a bottom half gets the cut face.
 */
export function drawCandle(ctx, c, t, part = 'whole') {
  const { w, len } = c
  ctx.save()
  ctx.translate(c.x, c.y)
  ctx.rotate(c.a)

  const grad = ctx.createLinearGradient(-w / 2, 0, w / 2, 0)
  grad.addColorStop(0, '#e6e1d2')
  grad.addColorStop(0.35, '#faf7ee')
  grad.addColorStop(1, '#d9d3c2')
  ctx.fillStyle = grad
  ctx.strokeStyle = 'rgba(20, 24, 30, 0.28)'
  ctx.lineWidth = 1
  const r = w * 0.3
  ctx.beginPath()
  ctx.roundRect(-w / 2, -len / 2, w, len, r)
  ctx.fill()
  ctx.stroke()

  // the cut face, so a half reads as a half rather than a shorter candle
  if (part !== 'whole') {
    ctx.fillStyle = 'rgba(28, 33, 40, 0.3)'
    ctx.beginPath()
    ctx.ellipse(0, part === 'top' ? len / 2 : -len / 2, w / 2, w * 0.17, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  // Wick and flame last, and moved up to the end of the candle: drawn at the
  // origin they sit halfway down the stick, where the wax covers them.
  if (part !== 'bottom') {
    ctx.translate(0, -len / 2)
    ctx.strokeStyle = 'rgba(20, 24, 30, 0.75)'
    ctx.lineWidth = Math.max(1.2, w * 0.1)
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(0, -w * 0.34)
    ctx.stroke()
    ctx.translate(0, -w * 0.34)
    drawFlame(ctx, w, t, c.seed)
  }
  ctx.restore()
}
