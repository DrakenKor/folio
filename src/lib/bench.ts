// Pure benchmark harness. It has no DOM or worker globals so it runs in
// Vitest/Node. The main-thread worker client lives in bench-client.ts: the
// worker imports this file, so it must not also be the file that spawns it.

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface Agreement { ok: boolean; maxError?: number }

type Comparable = ArrayLike<number> | string | number | bigint

function exact(a: Comparable, b: Comparable): Agreement {
  if (typeof a === 'object' && typeof b === 'object') {
    if (a.length !== b.length) return { ok: false }
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return { ok: false }
    return { ok: true }
  }
  return { ok: a === b }
}

function within1(a: ArrayLike<number>, b: ArrayLike<number>): Agreement {
  if (a.length !== b.length) return { ok: false }
  let maxError = 0
  for (let i = 0; i < a.length; i++) {
    const d = Math.abs(a[i] - b[i])
    if (d > maxError) maxError = d
  }
  return { ok: maxError <= 1, maxError }
}

function relative(tolerance = 1e-9) {
  return (a: ArrayLike<number>, b: ArrayLike<number>): Agreement => {
    if (a.length !== b.length) return { ok: false }
    let maxError = 0
    for (let i = 0; i < a.length; i++) {
      const x = a[i]
      const y = b[i]
      if (x === y) continue
      const scale = Math.max(Math.abs(x), Math.abs(y))
      const err = Math.abs(x - y) / scale
      if (!(err <= maxError)) {
        if (Number.isNaN(err)) return { ok: false, maxError: Infinity }
        maxError = err
      }
    }
    return { ok: maxError <= tolerance, maxError }
  }
}

export const agree = { exact, within1, relative }

export interface Side<I, O> {
  id: string
  label: string
  prepare?: () => I
  run: (input: I) => O | Promise<O>
}

export interface Stats { median: number; p10: number; p90: number; samples: number[]; iterations: number }

export interface BenchResult {
  stats: Record<string, Stats>
  valid: boolean
  maxError?: number
  verdict: string | null
  faster: string | null
  ratio: number | null
  // The first side's output from the untimed agreement run, for building previews.
  output?: unknown
}

export interface MeasureOptions {
  warmupMs?: number
  minSampleMs?: number
  samples?: number
  now?: () => number
  agree?: (a: unknown, b: unknown) => Agreement
  onSample?: (sideId: string, msPerCall: number, index: number) => void
  shouldCancel?: () => boolean
}

// Smallest span we will ever divide by: a clock that reports 0 must not make a result 0.
const MIN_SPAN_MS = 1e-6
const MAX_BATCH_WITH_PREPARE = 1 << 14
const MAX_BATCH = 1 << 20

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}

// Builds n inputs untimed, then times a single span around the n runs.
async function timeBatch<I, O>(side: Side<I, O>, n: number, now: () => number): Promise<number> {
  const prepare = side.prepare
  const inputs: I[] | null = prepare ? Array.from({ length: n }, () => prepare()) : null
  const t0 = now()
  for (let i = 0; i < n; i++) {
    const r = side.run(inputs ? inputs[i] : (undefined as I))
    if (r instanceof Promise) await r
  }
  return Math.max(now() - t0, MIN_SPAN_MS)
}

export function verdict(sides: { label: string; median: number }[]): { text: string; faster: number; ratio: number } | null {
  if (sides.length < 2 || sides.some(s => !Number.isFinite(s.median) || s.median <= 0)) return null
  const order = sides.map((_, i) => i).sort((a, b) => sides[a].median - sides[b].median)
  const ratio = sides[order[1]].median / sides[order[0]].median
  if (!Number.isFinite(ratio)) return null
  return { text: `${sides[order[0]].label} ${ratio.toFixed(1)}x faster`, faster: order[0], ratio }
}

export async function measure<I, O>(sides: Side<I, O>[], options: MeasureOptions = {}): Promise<BenchResult> {
  const {
    warmupMs = 200,
    minSampleMs = 20,
    samples = 30,
    now = () => performance.now(),
    onSample,
    shouldCancel,
  } = options
  const compare = options.agree ?? ((a, b) => exact(a as Comparable, b as Comparable))
  const cancelled = () => {
    if (shouldCancel?.()) throw new Error('cancelled')
  }

  // Agreement: one untimed run per side on its own prepared input, each against the first.
  let valid = true
  let maxError: number | undefined
  let output: unknown
  for (let s = 0; s < sides.length; s++) {
    cancelled()
    const out = await sides[s].run(sides[s].prepare ? sides[s].prepare!() : (undefined as I))
    if (s === 0) {
      output = out
      continue
    }
    const result = compare(output, out)
    if (!result.ok) valid = false
    if (result.maxError !== undefined) maxError = Math.max(maxError ?? 0, result.maxError)
  }

  // Warm up and calibrate: double the batch until a sample reaches the minimum.
  const batch: number[] = []
  for (const side of sides) {
    const cap = side.prepare ? MAX_BATCH_WITH_PREPARE : MAX_BATCH
    const start = now()
    let n = 1
    for (;;) {
      cancelled()
      const span = await timeBatch(side, n, now)
      const long = span >= minSampleMs
      const warm = now() - start >= warmupMs
      if (!long && n >= cap && (warm || span <= MIN_SPAN_MS)) break
      if (long && warm) break
      if (!long && n < cap) n *= 2
    }
    batch.push(n)
  }

  // Alternate the sides sample by sample.
  const collected = sides.map(() => [] as number[])
  for (let i = 0; i < samples; i++) {
    for (let s = 0; s < sides.length; s++) {
      cancelled()
      const ms = (await timeBatch(sides[s], batch[s], now)) / batch[s]
      collected[s].push(ms)
      onSample?.(sides[s].id, ms, i)
    }
  }

  const stats: Record<string, Stats> = {}
  sides.forEach((side, s) => {
    const sorted = [...collected[s]].sort((a, b) => a - b)
    stats[side.id] = {
      median: quantile(sorted, 0.5),
      p10: quantile(sorted, 0.1),
      p90: quantile(sorted, 0.9),
      samples: collected[s],
      iterations: batch[s],
    }
  })

  const v = valid ? verdict(sides.map(side => ({ label: side.label, median: stats[side.id].median }))) : null
  return {
    stats,
    valid,
    maxError,
    verdict: v ? v.text : null,
    faster: v ? sides[v.faster].id : null,
    ratio: v ? v.ratio : null,
    output,
  }
}

export type WorkloadResult = BenchResult & { workload: string; size: number; preview: unknown }

export interface WasmStatus {
  wasm: boolean
  error?: string
  info: { loadMs: number; rawBytes: number; encodedBytes: number | null } | null
}
