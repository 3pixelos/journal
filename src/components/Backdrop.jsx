/**
 * A monochrome mountain range behind the app.
 *
 * Four silhouette layers scroll horizontally at different speeds, so the
 * near ridges pass the far ones and the scene has depth. Each path is drawn
 * twice inside a 200%-wide SVG and the layer travels exactly one tile, so
 * the loop is seamless and never jumps.
 *
 * Strictly black and white — green and red are reserved for money, and a
 * coloured background was competing with the only two colours that carry
 * meaning here. Light mode is the same scene by day: a white sky, grey
 * ranges, and leaves, birds and a rabbit moving through it.
 */

// Every ridge starts and ends at the same height, which is what lets a tile
// butt against its own copy without a visible seam.
const RIDGES = [
  { d: 'M0,300 L120,210 L200,255 L320,150 L430,235 L540,175 L650,250 L760,195 L880,260 L1000,300',
    cls: 'ridge-far', dur: '150s' },
  { d: 'M0,330 L90,250 L170,300 L260,205 L350,285 L440,230 L530,300 L620,245 L710,310 L800,260 L900,320 L1000,330',
    cls: 'ridge-mid', dur: '95s' },
  { d: 'M0,355 L110,305 L210,348 L310,290 L420,342 L520,296 L630,352 L730,312 L840,357 L930,326 L1000,355',
    cls: 'ridge-near', dur: '62s' },
  { d: 'M0,382 L130,355 L240,378 L360,346 L480,376 L600,350 L720,380 L840,352 L940,378 L1000,382',
    cls: 'ridge-fore', dur: '38s' },
]

// Leaves for the daytime scene: left %, size, fall seconds, delay, sway
// seconds. Hand-picked rather than random so the drift never clumps and the
// same page looks the same every time you open it.
// left %, size, fall seconds, delay, sway seconds, how far the wind carries
// it across the screen. Hand-picked rather than random so the drift never
// clumps and the same page looks the same every time you open it.
const LEAVES = [
  [-4, 20, 24, '0s', 6, 34], [2, 14, 31, '5s', 8, 26], [9, 23, 20, '12s', 5, 40],
  [15, 16, 27, '3s', 7, 30], [22, 12, 34, '9s', 9, 22], [28, 21, 22, '16s', 6, 38],
  [34, 15, 29, '1s', 8, 28], [40, 18, 25, '7s', 6, 33], [46, 13, 33, '14s', 9, 24],
  [52, 22, 21, '4s', 5, 41], [57, 16, 28, '11s', 7, 29], [63, 12, 35, '18s', 10, 20],
  [68, 19, 23, '2s', 6, 36], [74, 14, 30, '8s', 8, 27], [79, 21, 26, '15s', 6, 32],
  [85, 13, 32, '6s', 9, 23], [90, 17, 24, '13s', 7, 35], [95, 15, 29, '20s', 8, 25],
  [12, 18, 26, '22s', 7, 31], [44, 20, 23, '26s', 6, 37], [71, 13, 33, '24s', 9, 21],
  [26, 16, 28, '30s', 8, 29],
]

// Gusts: top %, width, seconds to cross, delay. Long delays, so the wind
// comes and goes instead of blowing nonstop.
const GUSTS = [
  [11, 190, 9, '0s'], [26, 130, 11, '7s'], [38, 220, 8, '15s'],
  [57, 160, 12, '21s'], [19, 150, 10, '30s'],
]

// Clouds: top %, width, height, seconds to cross, delay.
const CLOUDS = [
  [7, 260, 60, 150, '0s'], [17, 180, 44, 115, '-40s'], [30, 320, 70, 190, '-90s'],
]

// Birds: each flock is top %, scale, seconds to cross, delay, flap seconds.
const BIRDS = [
  [13, 1, 44, '2s', 0.5], [16, 0.72, 44, '3.4s', 0.62], [10, 0.8, 44, '4.1s', 0.44],
  [33, 0.9, 62, '28s', 0.55], [36, 0.66, 62, '29.2s', 0.68],
]

const STARS = [
  [6, 12, 1.1, '0s'], [14, 26, 0.8, '1.4s'], [23, 8, 1.3, '2.9s'], [31, 31, 0.9, '0.7s'],
  [39, 17, 1.0, '3.6s'], [47, 29, 0.7, '2.1s'], [56, 11, 1.2, '4.3s'], [63, 24, 0.9, '1.1s'],
  [71, 15, 1.1, '3.1s'], [79, 30, 0.8, '0.4s'], [86, 20, 1.0, '2.6s'], [93, 9, 1.2, '4.8s'],
  [10, 38, 0.7, '1.9s'], [44, 40, 0.8, '3.9s'], [68, 37, 0.9, '0.9s'], [88, 42, 0.7, '2.4s'],
]

export default function Backdrop() {
  return (
    <div className="backdrop" aria-hidden="true">
      <div className="sky" />
      <div className="moon" />

      <div className="stars">
        {STARS.map(([x, y, r, delay]) => (
          <i
            key={`${x}-${y}`}
            style={{ left: `${x}%`, top: `${y}%`, width: r * 2, height: r * 2,
                     animationDelay: delay }}
          />
        ))}
      </div>

      <div className="clouds">
        {CLOUDS.map(([top, w, h, dur, delay]) => (
          <i key={`${top}-${w}`}
             style={{ top: `${top}%`, width: w, height: h,
                      animationDuration: `${dur}s`, animationDelay: delay }} />
        ))}
      </div>

      <div className="birds">
        {BIRDS.map(([top, scale, dur, delay, flap]) => (
          <span key={`${top}-${delay}`}
                style={{ top: `${top}%`, animationDuration: `${dur}s`, animationDelay: delay }}>
            <svg viewBox="0 0 24 10" style={{ width: 24 * scale, animationDuration: `${flap}s` }}>
              <path d="M1,8 Q6,1 11,7 Q16,1 23,8" />
            </svg>
          </span>
        ))}
      </div>

      <div className="leaves">
        {LEAVES.map(([x, size, dur, delay, sway, drift]) => (
          <i
            key={`${x}-${delay}`}
            style={{ left: `${x}%`, width: size, height: size,
                     animationDuration: `${dur}s`, animationDelay: delay,
                     '--sway': `${sway}s`, '--drift': `${drift}vw` }}
          />
        ))}
      </div>

      <div className="gusts">
        {GUSTS.map(([top, w, dur, delay]) => (
          <i key={`${top}-${delay}`}
             style={{ top: `${top}%`, width: w,
                      animationDuration: `${dur}s`, animationDelay: delay }} />
        ))}
      </div>

      {RIDGES.map((r) => (
        <div
          key={r.cls}
          className={`ridge ${r.cls}`}
          style={{ animationDuration: r.dur }}
        >
          <svg viewBox="0 0 2000 400" preserveAspectRatio="none">
            <path d={`${r.d} L1000,400 L0,400 Z`} />
            <g transform="translate(1000,0)">
              <path d={`${r.d} L1000,400 L0,400 Z`} />
            </g>
          </svg>
        </div>
      ))}

      {/* Painted after the ranges so it crosses in front of them, which is
          the only thing that makes it read as being on the ground. */}
      <div className="rabbit">
        <i>
          <svg viewBox="0 0 70 50">
            <ellipse cx="30" cy="33" rx="17" ry="12" />
            <circle cx="51" cy="24" r="8.5" />
            <ellipse cx="49" cy="10" rx="3.2" ry="9" transform="rotate(-14 49 10)" />
            <ellipse cx="56" cy="11" rx="3" ry="8.5" transform="rotate(7 56 11)" />
            <circle cx="12" cy="28" r="5" />
            <ellipse cx="23" cy="43" rx="8.5" ry="4" />
            <ellipse cx="44" cy="42" rx="5" ry="3.5" />
          </svg>
        </i>
      </div>

      <div className="mist mist-1" />
      <div className="mist mist-2" />
      <div className="grain" />
    </div>
  )
}
