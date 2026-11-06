/**
 * A monochrome mountain range behind the app.
 *
 * Four silhouette layers scroll horizontally at different speeds, so the
 * near ridges pass the far ones and the scene has depth. Each path is drawn
 * twice inside a 200%-wide SVG and the layer travels exactly one tile, so
 * the loop is seamless and never jumps.
 *
 * Dark mode is strictly black and white: green and red are reserved for
 * money, and a coloured night sky competed with the only two colours that
 * carry meaning here. Light mode is the same scene at daybreak, washed in
 * one blue with leaves drifting down through it.
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
const LEAVES = [
  [3, 17, 26, '0s', 7], [11, 12, 34, '6s', 9], [19, 20, 22, '3s', 6],
  [27, 13, 30, '11s', 8], [35, 16, 25, '1s', 7], [43, 11, 36, '8s', 10],
  [51, 19, 23, '15s', 6], [58, 14, 31, '4s', 9], [66, 12, 28, '19s', 8],
  [74, 20, 21, '9s', 6], [82, 13, 33, '2s', 9], [89, 17, 27, '13s', 7],
  [95, 12, 35, '17s', 10], [69, 15, 29, '23s', 8],
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

      <div className="leaves">
        {LEAVES.map(([x, size, dur, delay, sway]) => (
          <i
            key={`${x}-${delay}`}
            style={{ left: `${x}%`, width: size, height: size,
                     animationDuration: `${dur}s`, animationDelay: delay,
                     '--sway': `${sway}s` }}
          />
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

      <div className="mist mist-1" />
      <div className="mist mist-2" />
      <div className="grain" />
    </div>
  )
}
