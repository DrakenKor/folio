'use client'

import type { WorkloadResult } from '@/lib/bench'
import type { Workload } from '@/lib/bench-workloads'
import { median, ms, rowState, verdictText } from './format'

export interface Live {
  id: string
  samples: Record<string, number[]>
}

interface Props {
  rows: { w: Workload; result?: WorkloadResult }[]
  selected: string
  // Rows cannot be changed while a run is in progress
  locked: boolean
  live: Live | null
  wasm: boolean | null
  onSelect: (id: string) => void
}

const SIDES = [
  { id: 'rust', name: 'Rust', signal: 'compiled' },
  { id: 'js', name: 'JavaScript', signal: 'interpreted' },
]

interface Shown { median: number; p10?: number; p90?: number }

function shown(side: string, result: WorkloadResult | undefined, live: number[] | undefined): Shown | null {
  if (live) {
    const m = median(live)
    return m === null ? null : { median: m }
  }
  const s = result?.stats[side]
  return s ? { median: s.median, p10: s.p10, p90: s.p90 } : null
}

export function ResultBars({ rows, selected, locked, live, wasm, onSelect }: Props) {
  return (
    <ul className="wasm-rows">
      {rows.map(({ w, result }) => {
        const running = live?.id === w.id
        const bars = SIDES.map(side => ({ ...side, value: shown(side.id, running ? undefined : result, running ? live.samples[side.id] ?? [] : undefined) }))
        const scale = Math.max(...bars.map(b => (b.value ? b.value.p90 ?? b.value.median : 0)), 0)
        const state = running ? 'running' : rowState(result)
        const pct = (v: number) => `${Math.min(100, (v / scale) * 100)}%`
        return (
          <li key={w.id} className="wasm-row" data-selected={selected === w.id ? 'true' : 'false'}>
            <button type="button" className="wasm-row-head" aria-pressed={selected === w.id} disabled={locked && selected !== w.id} onClick={() => onSelect(w.id)}>
              <span className="wasm-row-name">{w.label}</span>
              <span className="wasm-row-size">{result ? w.sizeLabel(result.size) : ''}</span>
              <span className="wasm-row-verdict" data-signal={state === 'differ' ? 'change' : result?.faster === 'rust' && state === 'verdict' ? 'compiled' : result?.faster === 'js' && state === 'verdict' ? 'interpreted' : undefined}>
                {running ? 'Running' : verdictText(result)}
              </span>
            </button>
            {bars
              .filter(b => b.id === 'js' || wasm !== false)
              .map(b => (
                <div key={b.id} className="wasm-bar" data-side={b.id} data-state={state}>
                  <span className="wasm-bar-name">{b.name}</span>
                  <span className="wasm-bar-track">
                    {b.value && scale > 0 && <span className="wasm-bar-fill" style={{ width: pct(b.value.median) }} />}
                    {b.value?.p10 !== undefined && b.value.p90 !== undefined && scale > 0 && (
                      <span className="wasm-whisker" style={{ left: pct(b.value.p10), width: `calc(${pct(b.value.p90)} - ${pct(b.value.p10)})` }} />
                    )}
                  </span>
                  <span className="wasm-bar-ms">{b.value ? ms(b.value.median) : ''}</span>
                </div>
              ))}
          </li>
        )
      })}
    </ul>
  )
}
