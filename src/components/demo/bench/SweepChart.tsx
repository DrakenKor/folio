'use client'

import type { Workload } from '@/lib/bench-workloads'
import { count, ms } from './format'

export interface SweepPoint { size: number; rust?: number; js?: number; valid: boolean }

const W = 560
const H = 280
const M = { l: 56, r: 92, t: 16, b: 44 }

const short = (n: number) => (n >= 1e6 ? `${+(n / 1e6).toPrecision(2)}M` : n >= 1e3 ? `${+(n / 1e3).toPrecision(2)}k` : String(n))

export function SweepChart({ workload, points }: { workload: Workload; points: SweepPoint[] }) {
  const times = points.flatMap(p => [p.rust, p.js]).filter((t): t is number => t !== undefined && Number.isFinite(t) && t > 0)
  if (points.length === 0 || times.length === 0) return null

  const sizes = points.map(p => p.size)
  const x0 = Math.log10(Math.min(...sizes))
  const x1 = Math.log10(Math.max(...sizes))
  const y0 = Math.floor(Math.log10(Math.min(...times)))
  const y1 = Math.max(y0 + 1, Math.ceil(Math.log10(Math.max(...times))))
  const px = (size: number) => M.l + (x1 > x0 ? (Math.log10(size) - x0) / (x1 - x0) : 0.5) * (W - M.l - M.r)
  const py = (t: number) => H - M.b - ((Math.log10(t) - y0) / (y1 - y0)) * (H - M.t - M.b)

  const lines = (['rust', 'js'] as const)
    .map(side => ({ side, pts: points.filter(p => p[side] !== undefined && (p[side] as number) > 0) }))
    .filter(l => l.pts.length > 0)

  // The lines cross where the sign of log(rust / js) changes between two sizes.
  let cross: { x: number; y: number } | null = null
  const both = points.filter(p => p.rust && p.js && p.valid)
  for (let i = 1; i < both.length && !cross; i++) {
    const a = Math.log(both[i - 1].rust! / both[i - 1].js!)
    const b = Math.log(both[i].rust! / both[i].js!)
    if (a === 0 || a * b < 0) {
      const t = a === b ? 0 : a / (a - b)
      const s0 = Math.log10(both[i - 1].size)
      const s1 = Math.log10(both[i].size)
      const l0 = Math.log10(both[i - 1].js!)
      const l1 = Math.log10(both[i].js!)
      const size = 10 ** (s0 + (s1 - s0) * t)
      cross = { x: size, y: 10 ** (l0 + (l1 - l0) * t) }
    }
  }

  const yTicks = Array.from({ length: y1 - y0 + 1 }, (_, i) => 10 ** (y0 + i))
  const label = `${workload.label}: time against size on log axes. ` +
    points.map(p => `${count(p.size)}: Rust ${ms(p.rust)}, JavaScript ${ms(p.js)}`).join('; ')

  return (
    <figure className="wasm-sweep">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        {yTicks.map(t => (
          <g key={t}>
            <line className="wasm-grid" x1={M.l} x2={W - M.r} y1={py(t)} y2={py(t)} />
            <text className="wasm-axis" x={M.l - 8} y={py(t) + 4} textAnchor="end">{ms(t)}</text>
          </g>
        ))}
        {points.map(p => (
          <text key={p.size} className="wasm-axis" x={px(p.size)} y={H - M.b + 18} textAnchor="middle">{short(p.size)}</text>
        ))}
        <text className="wasm-axis" x={(M.l + W - M.r) / 2} y={H - 4} textAnchor="middle">Size</text>
        {lines.map(({ side, pts }) => {
          const last = pts[pts.length - 1]
          const y = py(last[side] as number)
          return (
            <g key={side} data-side={side}>
              <polyline className="wasm-line" fill="none" points={pts.map(p => `${px(p.size)},${py(p[side] as number)}`).join(' ')} />
              {pts.map(p => <circle key={p.size} className="wasm-dot" cx={px(p.size)} cy={py(p[side] as number)} r={3} />)}
              <text className="wasm-line-label" x={px(last.size) + 8} y={y + 4}>{side === 'rust' ? 'Rust' : 'JavaScript'}</text>
            </g>
          )
        })}
        {cross && (
          <g>
            <circle className="wasm-cross" cx={px(cross.x)} cy={py(cross.y)} r={7} fill="none" />
            <text className="wasm-axis" x={px(cross.x)} y={py(cross.y) - 12} textAnchor="middle">cross near {short(Math.round(cross.x))}</text>
          </g>
        )}
      </svg>
      <figcaption>
        {workload.label} at {points.length} sizes. Both axes are logarithmic.{both.length > 1 && !cross ? ' The lines do not cross in this range.' : ''}
      </figcaption>
    </figure>
  )
}
