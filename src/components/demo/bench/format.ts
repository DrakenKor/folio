import type { WorkloadResult } from '@/lib/bench'
import type { Workload } from '@/lib/bench-workloads'

export const DASH = '—'

// The one number formatter: anything not finite and positive prints as a dash.
export function num(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) return DASH
  return value.toPrecision(digits)
}

export function ms(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) return DASH
  const text = value >= 100 ? value.toFixed(0) : value >= 10 ? value.toFixed(1) : value >= 1 ? value.toFixed(2) : value.toPrecision(2)
  return `${text} ms`
}

export function count(value: number | null | undefined): string {
  return value === null || value === undefined || !Number.isFinite(value) ? DASH : Math.round(value).toLocaleString('en-US')
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = sorted.length >> 1
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export type RowState = 'idle' | 'differ' | 'verdict' | 'single'

export function rowState(result: WorkloadResult | undefined): RowState {
  if (!result) return 'idle'
  if (!result.valid) return 'differ'
  return result.verdict ? 'verdict' : 'single'
}

export function verdictText(result: WorkloadResult | undefined): string {
  const state = rowState(result)
  if (state === 'differ') return 'Outputs differ'
  if (state === 'verdict') return result!.verdict!
  if (state === 'single') return 'JavaScript only, no verdict'
  return 'Not run'
}

// The cells of one results row, shared by the on-screen table and the copied Markdown.
export function cells(w: Workload, result: WorkloadResult | undefined): string[] {
  return [
    result ? `${w.label}, ${w.sizeLabel(result.size)}` : w.label,
    ms(result?.stats.rust?.median),
    ms(result?.stats.js?.median),
    result ? verdictText(result) : DASH,
  ]
}

export const TABLE_HEAD = ['Workload', 'Rust median', 'JavaScript median', 'Verdict']

export function markdown(rows: { w: Workload; result?: WorkloadResult }[]): string {
  const line = (row: string[]) => `| ${row.join(' | ')} |`
  return [
    line(TABLE_HEAD),
    line(TABLE_HEAD.map(() => '---')),
    ...rows.filter(r => r.result).map(r => line(cells(r.w, r.result))),
  ].join('\n')
}

// Geometric mean of JavaScript time over Rust time, over results where both ran and agreed.
export function geomean(results: (WorkloadResult | undefined)[]): { text: string; n: number } | null {
  const logs: number[] = []
  for (const r of results) {
    const rust = r?.stats.rust?.median
    const js = r?.stats.js?.median
    if (r?.valid && rust && js && rust > 0 && js > 0) logs.push(Math.log(js / rust))
  }
  if (logs.length === 0) return null
  const g = Math.exp(logs.reduce((a, b) => a + b, 0) / logs.length)
  if (!Number.isFinite(g) || g <= 0) return null
  return { text: g >= 1 ? `Rust ${g.toFixed(1)}x faster` : `JavaScript ${(1 / g).toFixed(1)}x faster`, n: logs.length }
}
