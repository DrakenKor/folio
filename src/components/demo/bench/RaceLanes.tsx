'use client'

import { Ref, useEffect, useImperativeHandle, useRef } from 'react'
import type { Workload } from '@/lib/bench-workloads'
import type { WorkloadResult } from '@/lib/bench'
import { drawBodies, drawMandelbrot, drawPreview, parseColor, type MandelChunk, type Rgb } from './drawing'

export interface LanesHandle {
  reset(): void
  // fraction 0..1 and the text beside the bar; chunk is a race chunk to draw, when there is one
  progress(workloadId: string, side: string, fraction: number, label: string, chunk?: unknown): void
}

interface Props {
  ref: Ref<LanesHandle>
  workload: Workload
  // The size the shown result was measured at, or the slider's size before any result exists
  size: number
  result?: WorkloadResult
  // null until the module status is known
  wasm: boolean | null
  running: boolean
}

interface LaneNodes { bar: HTMLElement | null; text: HTMLElement | null; canvas: HTMLCanvasElement | null }

const FALLBACK: Record<string, Rgb> = { rust: [94, 234, 212], js: [250, 204, 21] }
const TOKEN: Record<string, string> = { rust: '--signal-compiled', js: '--signal-interpreted' }
const NAME: Record<string, string> = { rust: 'Rust', js: 'JavaScript' }

export function RaceLanes({ ref, workload, size, result, wasm, running }: Props) {
  const nodes = useRef<Record<string, LaneNodes>>({ rust: { bar: null, text: null, canvas: null }, js: { bar: null, text: null, canvas: null } })
  const root = useRef<HTMLDivElement | null>(null)
  const racing = !!workload.race
  const sides = wasm === false ? ['js'] : ['rust', 'js']

  const tint = (side: string): Rgb => {
    const el = root.current
    if (!el || !racing) return [209, 209, 209]
    return parseColor(getComputedStyle(el).getPropertyValue(TOKEN[side]), FALLBACK[side])
  }

  const canvasFor = (side: string) => nodes.current[racing ? side : 'js'].canvas?.getContext('2d') ?? null

  useImperativeHandle(ref, () => ({
    reset() {
      for (const lane of Object.values(nodes.current)) {
        if (lane.bar) lane.bar.style.width = '0%'
        if (lane.text) lane.text.textContent = ''
        const ctx = lane.canvas?.getContext('2d')
        if (ctx) ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
      }
    },
    progress(workloadId, side, fraction, label, chunk) {
      const lane = nodes.current[side]
      if (lane.bar) lane.bar.style.width = `${Math.round(fraction * 100)}%`
      if (lane.text) lane.text.textContent = label
      const ctx = chunk ? canvasFor(side) : null
      if (!ctx) return
      if (workloadId === 'mandelbrot') drawMandelbrot(ctx, chunk as MandelChunk, tint(side))
      else if (workloadId === 'nbody') drawBodies(ctx, (chunk as { positions: Float64Array }).positions, tint(side))
    },
  }))

  // The finished picture: the output both engines agreed on, or the JavaScript one if they did not.
  useEffect(() => {
    if (!result) return
    const done = result.valid ? 'done' : 'outputs differ'
    for (const side of sides) {
      const lane = nodes.current[side]
      if (lane.bar) lane.bar.style.width = '100%'
      if (lane.text) lane.text.textContent = done
      const ctx = racing ? canvasFor(side) : null
      if (ctx && (side === 'js' || result.valid)) drawPreview(ctx, result.preview, tint(side))
    }
    if (!racing) {
      const ctx = canvasFor('js')
      if (ctx) drawPreview(ctx, result.preview, [209, 209, 209])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result])

  const alt = (side: string) =>
    racing
      ? `${NAME[side]} output for ${workload.label}, ${workload.sizeLabel(size)}, drawn as it is computed`
      : `Output of ${workload.label}, ${workload.sizeLabel(size)}`

  return (
    <div className="wasm-lanes" ref={root} data-racing={racing ? 'true' : 'false'}>
      <h2 className="wasm-lanes-title">
        {workload.label}, <span>{workload.sizeLabel(size)}</span>
      </h2>
      <p className="wasm-lanes-note">{!result && !running ? 'Not run yet. Choose Run.' : racing ? 'The race below is for show; the timed run is separate.' : 'This workload has no race. The picture is its output.'}</p>
      {sides.map(side => (
        <div className="wasm-lane" key={side} data-side={side}>
          <div className="wasm-lane-head">
            <span data-signal={side === 'rust' ? 'compiled' : 'interpreted'}>{NAME[side]}</span>
            <span ref={node => { nodes.current[side].text = node }} className="wasm-lane-text" />
          </div>
          <div className="wasm-lane-track" aria-hidden="true">
            <div ref={node => { nodes.current[side].bar = node }} />
          </div>
          {racing && (
            <div className="wasm-pic">
              <canvas ref={node => { nodes.current[side].canvas = node }} role="img" aria-label={alt(side)} />
            </div>
          )}
        </div>
      ))}
      {!racing && (
        <div className="wasm-pic wasm-pic-output">
          <canvas ref={node => { nodes.current.js.canvas = node }} role="img" aria-label={alt('js')} />
        </div>
      )}
      {wasm === false && <p className="wasm-lanes-note">The Rust lane is missing because the module did not load.</p>}
    </div>
  )
}
