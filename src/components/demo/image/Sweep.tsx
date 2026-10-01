'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/demo/controls'
import type { FilterCall } from '@/lib/image-filters'
import type { ImageReply, ImageRequest } from '@/lib/image.worker'

interface Point {
  size: number
  rustMs: number | null
  jsMs: number
  valid: boolean
}

interface SweepProps {
  call: FilterCall
  filterLabel: string
}

const W = 520
const H = 280
const PAD = { left: 56, right: 92, top: 28, bottom: 44 }

const megapixels = (size: number) => (size * size) / 1e6
const formatMs = (ms: number) => (ms >= 100 ? ms.toFixed(0) : ms >= 10 ? ms.toFixed(1) : ms.toFixed(2))

// Log axes with ticks at powers of ten
function Chart({ points }: { points: Point[] }) {
  const xs = points.map(p => megapixels(p.size))
  const ys = points.flatMap(p => [p.jsMs, p.rustMs ?? p.jsMs])
  const lo = (values: number[]) => Math.floor(Math.log10(Math.min(...values)))
  const hi = (values: number[]) => Math.ceil(Math.log10(Math.max(...values)))
  const x0 = lo(xs)
  const x1 = Math.max(hi(xs), x0 + 1)
  const y0 = lo(ys)
  const y1 = Math.max(hi(ys), y0 + 1)
  const px = (v: number) => PAD.left + ((Math.log10(v) - x0) / (x1 - x0)) * (W - PAD.left - PAD.right)
  const py = (v: number) => H - PAD.bottom - ((Math.log10(v) - y0) / (y1 - y0)) * (H - PAD.top - PAD.bottom)
  const decades = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => Math.pow(10, a + i))
  const line = (get: (p: Point) => number | null) => {
    const own = points.filter(p => get(p) !== null)
    return {
      own,
      path: own.map((p, i) => `${i ? 'L' : 'M'}${px(megapixels(p.size)).toFixed(1)} ${py(get(p)!).toFixed(1)}`).join(' ')
    }
  }
  const rust = line(p => p.rustMs)
  const js = line(p => p.jsMs)
  const tail = (series: ReturnType<typeof line>, get: (p: Point) => number | null) => {
    const last = series.own[series.own.length - 1]
    return last ? { x: px(megapixels(last.size)) + 8, y: py(get(last)!) } : null
  }
  const rustEnd = tail(rust, p => p.rustMs)
  const jsEnd = tail(js, p => p.jsMs)

  return (
    <svg className="image-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Time per call against megapixels, both on log axes, for Rust and JavaScript">
      {decades(x0, x1).map(v => (
        <g key={`x${v}`}>
          <line className="image-chart-grid" x1={px(v)} x2={px(v)} y1={PAD.top} y2={H - PAD.bottom} />
          <text className="image-chart-tick" x={px(v)} y={H - PAD.bottom + 16} textAnchor="middle">
            {v}
          </text>
        </g>
      ))}
      {decades(y0, y1).map(v => (
        <g key={`y${v}`}>
          <line className="image-chart-grid" x1={PAD.left} x2={W - PAD.right} y1={py(v)} y2={py(v)} />
          <text className="image-chart-tick" x={PAD.left - 8} y={py(v) + 4} textAnchor="end">
            {v}
          </text>
        </g>
      ))}
      <text className="image-chart-tick" x={(PAD.left + W - PAD.right) / 2} y={H - 6} textAnchor="middle">
        megapixels
      </text>
      <text className="image-chart-tick" x={12} y={12}>
        ms per call
      </text>
      {rust.own.length > 0 && <path className="image-chart-line" data-signal="compiled" d={rust.path} />}
      <path className="image-chart-line" data-signal="interpreted" d={js.path} />
      {rust.own.map(p => (
        <circle key={`r${p.size}`} className="image-chart-dot" data-signal="compiled" cx={px(megapixels(p.size))} cy={py(p.rustMs!)} r={3} />
      ))}
      {js.own.map(p => (
        <circle key={`j${p.size}`} className="image-chart-dot" data-signal="interpreted" cx={px(megapixels(p.size))} cy={py(p.jsMs)} r={3} />
      ))}
      {rustEnd && (
        <text className="image-chart-label" data-signal="compiled" x={rustEnd.x} y={rustEnd.y + 12}>
          Rust
        </text>
      )}
      {jsEnd && (
        <text className="image-chart-label" data-signal="interpreted" x={jsEnd.x} y={jsEnd.y - 2}>
          JavaScript
        </text>
      )}
    </svg>
  )
}

/**
 * Runs the current filter at five sizes in a worker of its own through the
 * bench.ts harness, only when asked. Cancelling terminates that worker.
 */
export function Sweep({ call, filterLabel }: SweepProps) {
  const [points, setPoints] = useState<Point[]>([])
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ran, setRan] = useState<string | null>(null)
  const worker = useRef<Worker | null>(null)

  const stop = () => {
    worker.current?.terminate()
    worker.current = null
    setRunning(false)
  }
  useEffect(() => () => worker.current?.terminate(), [])

  const start = () => {
    stop()
    setPoints([])
    setError(null)
    setRan(filterLabel)
    setRunning(true)
    const next = new Worker(new URL('../../../lib/image.worker.ts', import.meta.url), { type: 'module' })
    worker.current = next
    next.onmessage = (event: MessageEvent<ImageReply>) => {
      const reply = event.data
      if (reply.type === 'point') setPoints(all => [...all, reply])
      else if (reply.type === 'done') stop()
      else if (reply.type === 'error') {
        setError(reply.message)
        stop()
      }
    }
    const message: ImageRequest = { type: 'sweep', id: 1, call }
    next.postMessage(message)
  }

  return (
    <div className="image-sweep">
      <Button onClick={running ? stop : start}>{running ? 'Cancel sweep' : `Run size sweep for ${filterLabel}`}</Button>
      {running && (
        <p role="status">
          {points.length} of 5 sizes done{points.length < 5 ? `, running ${[256, 512, 1024, 2048, 4096][points.length]} px` : ''}
        </p>
      )}
      {error && <p role="alert">The sweep failed: {error}. Run it again.</p>}
      {points.length > 0 && (
        <>
          <Chart points={points} />
          <table className="image-sweep-table">
            <caption>{ran}, square images, median time per call</caption>
            <thead>
              <tr>
                <th scope="col">Size</th>
                <th scope="col">Rust</th>
                <th scope="col">JavaScript</th>
              </tr>
            </thead>
            <tbody>
              {points.map(p => (
                <tr key={p.size}>
                  <td>{p.size} px</td>
                  <td data-signal={p.valid ? 'compiled' : 'change'}>{p.rustMs === null ? 'unavailable' : `${formatMs(p.rustMs)} ms${p.valid ? '' : ', outputs differ'}`}</td>
                  <td data-signal="interpreted">{formatMs(p.jsMs)} ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}
