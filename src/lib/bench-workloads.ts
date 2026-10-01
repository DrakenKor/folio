// The benchmark registry and the JavaScript twins. Each twin copies the Rust
// export's loop order and semantics and is written the way a careful person
// would write it: typed arrays, no allocation in inner loops.

import { agree, measure, mulberry32 } from './bench'
import type { Agreement, Side } from './bench'
import { loadWasm, wasmInfo } from './wasm'
import type { WasmExports } from './wasm'

export interface Workload {
  id: string
  label: string
  defaultSize: number
  minSize: number
  maxSize: number
  entranceSize: number
  sizeLabel: (size: number) => string
  group: 'main' | 'small' | 'crypto'
  build: (size: number, wasm: WasmExports | null) => {
    sides: Side<any, any>[]
    agree: (a: any, b: any) => Agreement
    preview: (output: any) => unknown
  }
  race?: (size: number, side: 'rust' | 'js', wasm: WasmExports | null) => RaceLane
}

// One engine's visible, untimed run, cut into small units. The host owns scheduling.
export interface RaceLane {
  units: number
  step(index: number): void
  snapshot(from: number, to: number): unknown
}

const fmt = (n: number) => n.toLocaleString('en-US')
const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0))

function need(wasm: WasmExports | null): WasmExports {
  if (!wasm) throw new Error('The WebAssembly module is not available')
  return wasm
}

function seededFloats(n: number, seed: number, lo: number, hi: number): Float64Array {
  const rng = mulberry32(seed)
  const out = new Float64Array(n)
  for (let i = 0; i < n; i++) out[i] = lo + (hi - lo) * rng()
  return out
}

// Picks `count` evenly spaced elements.
function sampleEven(a: ArrayLike<number>, count: number): Float64Array {
  const n = Math.min(count, a.length)
  const out = new Float64Array(n)
  for (let i = 0; i < n; i++) out[i] = a[Math.floor((i * a.length) / n)]
  return out
}

// Nearest-neighbour downsample of a square size x size grid to at most `max` per side.
function downsample<T extends Uint8Array | Float64Array>(src: T, size: number, max: number): { size: number; data: T } {
  const step = Math.ceil(size / max)
  const m = Math.ceil(size / step)
  const data = new (src.constructor as new (n: number) => T)(m * m)
  for (let y = 0; y < m; y++) for (let x = 0; x < m; x++) data[y * m + x] = src[y * step * size + x * step]
  return { size: m, data }
}

// ---------------------------------------------------------------------------
// Mandelbrot

export function mandelbrotRowsJs(width: number, height: number, maxIter: number, y0: number, y1: number, out: Uint8Array): void {
  for (let y = y0; y < y1; y++) {
    const cy = -1.5 + (3.0 * y) / height
    for (let x = 0; x < width; x++) {
      const cx = -2.2 + (3.0 * x) / width
      let zx = 0
      let zy = 0
      let i = 0
      while (i < maxIter && zx * zx + zy * zy <= 4.0) {
        const t = zx * zx - zy * zy + cx
        zy = 2.0 * zx * zy + cy
        zx = t
        i++
      }
      out[y * width + x] = i < 255 ? i : 255
    }
  }
}

const MANDEL_ITER = 255

const mandelbrot: Workload = {
  id: 'mandelbrot',
  label: 'Mandelbrot',
  defaultSize: 1024,
  minSize: 256,
  maxSize: 2048,
  entranceSize: 256,
  sizeLabel: n => `${n} x ${n}`,
  group: 'main',
  build(size, wasm) {
    const alloc = () => new Uint8Array(size * size)
    const sides: Side<Uint8Array, Uint8Array>[] = []
    if (wasm) sides.push({ id: 'rust', label: 'Rust', prepare: alloc, run: out => { wasm.mandelbrot(size, size, MANDEL_ITER, out); return out } })
    sides.push({ id: 'js', label: 'JavaScript', prepare: alloc, run: out => { mandelbrotRowsJs(size, size, MANDEL_ITER, 0, size, out); return out } })
    return {
      sides,
      agree: agree.exact,
      preview: (out: Uint8Array) => {
        const d = downsample(out, size, 256)
        return { width: d.size, height: d.size, data: d.data }
      },
    }
  },
  race(size, side, wasm) {
    const out = new Uint8Array(size * size)
    const rust = side === 'rust' ? need(wasm) : null
    return {
      units: size,
      step: y => (rust ? rust.mandelbrot_rows(size, size, MANDEL_ITER, y, y + 1, out) : mandelbrotRowsJs(size, size, MANDEL_ITER, y, y + 1, out)),
      snapshot: (y0, y1) => ({ y0, y1, width: size, rows: out.slice(y0 * size, y1 * size) }),
    }
  },
}

// ---------------------------------------------------------------------------
// N-body

export function nbodyJs(positions: Float64Array, velocities: Float64Array, masses: Float64Array, steps: number, dt: number): void {
  const n = masses.length
  const acc = new Float64Array(2 * n)
  for (let s = 0; s < steps; s++) {
    for (let i = 0; i < n; i++) {
      const xi = positions[2 * i]
      const yi = positions[2 * i + 1]
      let ax = 0
      let ay = 0
      for (let j = 0; j < n; j++) {
        if (j === i) continue
        const dx = positions[2 * j] - xi
        const dy = positions[2 * j + 1] - yi
        const d2 = dx * dx + dy * dy + 0.01
        const inv = masses[j] / (d2 * Math.sqrt(d2))
        ax += dx * inv
        ay += dy * inv
      }
      acc[2 * i] = ax
      acc[2 * i + 1] = ay
    }
    for (let i = 0; i < n; i++) {
      velocities[2 * i] += acc[2 * i] * dt
      velocities[2 * i + 1] += acc[2 * i + 1] * dt
      positions[2 * i] += velocities[2 * i] * dt
      positions[2 * i + 1] += velocities[2 * i + 1] * dt
    }
  }
}

const NBODY_STEPS = 50
const NBODY_DT = 0.01

function nbodyInputs(n: number) {
  return {
    positions: seededFloats(2 * n, 0xb0d1e5, -10, 10),
    velocities: seededFloats(2 * n, 0x5eed, -0.5, 0.5),
    masses: seededFloats(n, 0x3a55, 0.5, 1.5),
  }
}

const nbody: Workload = {
  id: 'nbody',
  label: 'N-body gravity',
  defaultSize: 1000,
  minSize: 250,
  maxSize: 4000,
  entranceSize: 250,
  sizeLabel: n => `${fmt(n)} bodies`,
  group: 'main',
  build(size, wasm) {
    const { positions, velocities, masses } = nbodyInputs(size)
    const fresh = () => ({ p: positions.slice(), v: velocities.slice() })
    const sides: Side<{ p: Float64Array; v: Float64Array }, Float64Array>[] = []
    if (wasm) sides.push({ id: 'rust', label: 'Rust', prepare: fresh, run: ({ p, v }) => { wasm.nbody(p, v, masses, NBODY_STEPS, NBODY_DT); return p } })
    sides.push({ id: 'js', label: 'JavaScript', prepare: fresh, run: ({ p, v }) => { nbodyJs(p, v, masses, NBODY_STEPS, NBODY_DT); return p } })
    return {
      sides,
      agree: agree.relative(1e-9),
      preview: (p: Float64Array) => ({ positions: p.slice(0, 4000) }),
    }
  },
  race(size, side, wasm) {
    const { positions: p, velocities: v, masses } = nbodyInputs(size)
    const rust = side === 'rust' ? need(wasm) : null
    return {
      units: NBODY_STEPS,
      step: () => (rust ? rust.nbody(p, v, masses, 1, NBODY_DT) : nbodyJs(p, v, masses, 1, NBODY_DT)),
      snapshot: () => ({ positions: p.slice(0, 4000) }),
    }
  },
}

// ---------------------------------------------------------------------------
// Matrix multiply

export function matrixMultiplyJs(a: Float64Array, b: Float64Array, rowsA: number, colsA: number, colsB: number): Float64Array {
  const result = new Float64Array(rowsA * colsB)
  for (let i = 0; i < rowsA; i++) {
    for (let j = 0; j < colsB; j++) {
      let sum = 0
      for (let k = 0; k < colsA; k++) sum += a[i * colsA + k] * b[k * colsB + j]
      result[i * colsB + j] = sum
    }
  }
  return result
}

const matrix: Workload = {
  id: 'matrix',
  label: 'Matrix multiply',
  defaultSize: 384,
  minSize: 64,
  maxSize: 768,
  entranceSize: 128,
  sizeLabel: n => `${n} x ${n}`,
  group: 'main',
  build(n, wasm) {
    const a = seededFloats(n * n, 0xa11, 0, 1)
    const b = seededFloats(n * n, 0xb22, 0, 1)
    const sides: Side<undefined, Float64Array>[] = []
    if (wasm) sides.push({ id: 'rust', label: 'Rust', run: () => wasm.matrix_multiply(a, b, n, n, n) })
    sides.push({ id: 'js', label: 'JavaScript', run: () => matrixMultiplyJs(a, b, n, n, n) })
    return {
      sides,
      agree: agree.relative(1e-9),
      preview: (c: Float64Array) => {
        const d = downsample(c, n, 64)
        return { size: d.size, data: d.data }
      },
    }
  },
}

// ---------------------------------------------------------------------------
// Prime sieve

export function sieveJs(limit: number): Uint32Array {
  if (limit < 2) return new Uint32Array(0)
  const composite = new Uint8Array(limit + 1)
  for (let p = 2; p * p <= limit; p++) {
    if (composite[p]) continue
    for (let i = p * p; i <= limit; i += p) composite[i] = 1
  }
  let count = 0
  for (let i = 2; i <= limit; i++) if (!composite[i]) count++
  const primes = new Uint32Array(count)
  let k = 0
  for (let i = 2; i <= limit; i++) if (!composite[i]) primes[k++] = i
  return primes
}

const sieve: Workload = {
  id: 'sieve',
  label: 'Prime sieve',
  defaultSize: 10_000_000,
  minSize: 100_000,
  maxSize: 50_000_000,
  entranceSize: 1_000_000,
  sizeLabel: n => `up to ${fmt(n)}`,
  group: 'main',
  build(limit, wasm) {
    const sides: Side<undefined, Uint32Array>[] = []
    if (wasm) sides.push({ id: 'rust', label: 'Rust', run: () => wasm.prime_sieve(limit) })
    sides.push({ id: 'js', label: 'JavaScript', run: () => sieveJs(limit) })
    return {
      sides,
      agree: agree.exact,
      preview: (primes: Uint32Array) => {
        let end = 0
        while (end < primes.length && primes[end] < 10_000) end++
        return { count: primes.length, small: primes.slice(0, end) }
      },
    }
  },
}

// ---------------------------------------------------------------------------
// Sort

function buildSort(size: number, wasm: WasmExports | null) {
  const base = seededFloats(size, 0x5027, 0, 1e6)
  const sides: Side<Float64Array, Float64Array>[] = []
  if (wasm) sides.push({ id: 'rust', label: 'Rust', prepare: () => base.slice(), run: arr => { wasm.sort_array(arr); return arr } })
  sides.push({ id: 'js', label: 'JavaScript', prepare: () => base.slice(), run: arr => arr.sort() })
  return {
    sides,
    agree: agree.exact,
    preview: (sorted: Float64Array) => ({ before: sampleEven(base, 256), after: sampleEven(sorted, 256) }),
  }
}

const sort: Workload = {
  id: 'sort',
  label: 'Sort',
  defaultSize: 1_000_000,
  minSize: 10_000,
  maxSize: 4_000_000,
  entranceSize: 100_000,
  sizeLabel: n => `${fmt(n)} elements`,
  group: 'main',
  build: buildSort,
}

// ---------------------------------------------------------------------------
// Small work and strings

function fibJs(n: number): number {
  if (n <= 1) return n
  let a = 0
  let b = 1
  for (let i = 2; i <= n; i++) {
    const t = a + b
    a = b
    b = t
  }
  return b
}

const tinyCalls: Workload = {
  id: 'tiny-calls',
  label: 'A million tiny calls',
  defaultSize: 1_000_000,
  minSize: 100_000,
  maxSize: 1_000_000,
  entranceSize: 100_000,
  sizeLabel: n => `${fmt(n)} calls to fibonacci(10)`,
  group: 'small',
  build(calls, wasm) {
    const sides: Side<undefined, number>[] = []
    if (wasm) {
      sides.push({
        id: 'rust',
        label: 'Rust',
        run: () => {
          let sum = 0
          for (let i = 0; i < calls; i++) sum += Number(wasm.fibonacci(10))
          return sum
        },
      })
    }
    sides.push({
      id: 'js',
      label: 'JavaScript',
      run: () => {
        let sum = 0
        for (let i = 0; i < calls; i++) sum += fibJs(10)
        return sum
      },
    })
    return { sides, agree: agree.exact, preview: (sum: number) => ({ sum }) }
  },
}

// A seeded string of about `chars` code points: ASCII words, accented letters,
// CJK, one astral character and two non-ASCII spaces. Built from escapes.
function seededText(chars: number): string {
  const rng = mulberry32(0x57a1)
  const units = new Uint16Array(chars * 2)
  let n = 0
  for (let i = 0; i < chars; i++) {
    const r = rng()
    if (r < 0.15) units[n++] = 0x20
    else if (r < 0.16) units[n++] = 0x3000
    else if (r < 0.17) units[n++] = 0xa0
    else if (r < 0.22) units[n++] = 0xe9
    else if (r < 0.26) units[n++] = 0x4e2d
    else if (r < 0.28) {
      units[n++] = 0xd83d
      units[n++] = 0xde00
    } else units[n++] = 0x61 + Math.floor(rng() * 26)
  }
  return unitsToString(units, n)
}

function unitsToString(units: Uint16Array, length: number): string {
  const parts: string[] = []
  for (let i = 0; i < length; i += 8192) parts.push(String.fromCharCode(...units.subarray(i, Math.min(length, i + 8192))))
  return parts.join('')
}

export function reverseStringJs(s: string): string {
  const n = s.length
  const out = new Uint16Array(n)
  let w = n
  for (let i = 0; i < n; ) {
    const c = s.charCodeAt(i)
    if (c >= 0xd800 && c < 0xdc00 && i + 1 < n) {
      const d = s.charCodeAt(i + 1)
      if (d >= 0xdc00 && d < 0xe000) {
        w -= 2
        out[w] = c
        out[w + 1] = d
        i += 2
        continue
      }
    }
    out[--w] = c
    i++
  }
  return unitsToString(out, n)
}

// Unicode White_Space, which is what Rust's split_whitespace uses.
function isSpace(c: number): boolean {
  return (c >= 9 && c <= 13) || c === 32 || c === 0x85 || c === 0xa0 || c === 0x1680 ||
    (c >= 0x2000 && c <= 0x200a) || c === 0x2028 || c === 0x2029 || c === 0x202f || c === 0x205f || c === 0x3000
}

export function countWordsJs(s: string): number {
  let words = 0
  let inWord = false
  for (let i = 0; i < s.length; i++) {
    const space = isSpace(s.charCodeAt(i))
    if (!space && !inWord) words++
    inWord = !space
  }
  return words
}

const stringsReverse: Workload = {
  id: 'strings-reverse',
  label: 'Reverse a 1 MB string',
  defaultSize: 1_000_000,
  minSize: 100_000,
  maxSize: 2_000_000,
  entranceSize: 100_000,
  sizeLabel: n => `${fmt(n)} characters`,
  group: 'small',
  build(chars, wasm) {
    const text = seededText(chars)
    const sides: Side<undefined, string>[] = []
    if (wasm) sides.push({ id: 'rust', label: 'Rust', run: () => wasm.reverse_string(text) })
    sides.push({ id: 'js', label: 'JavaScript', run: () => reverseStringJs(text) })
    return { sides, agree: agree.exact, preview: (s: string) => ({ length: s.length, head: s.slice(0, 40) }) }
  },
}

const stringsCount: Workload = {
  id: 'strings-count',
  label: 'Count words in a 1 MB string',
  defaultSize: 1_000_000,
  minSize: 100_000,
  maxSize: 2_000_000,
  entranceSize: 100_000,
  sizeLabel: n => `${fmt(n)} characters`,
  group: 'small',
  build(chars, wasm) {
    const text = seededText(chars)
    const sides: Side<undefined, number>[] = []
    if (wasm) sides.push({ id: 'rust', label: 'Rust', run: () => wasm.count_words(text) })
    sides.push({ id: 'js', label: 'JavaScript', run: () => countWordsJs(text) })
    return { sides, agree: agree.exact, preview: (count: number) => ({ count }) }
  },
}

const sortSmall: Workload = {
  id: 'sort-small',
  label: 'Sort 100 numbers',
  defaultSize: 100,
  minSize: 100,
  maxSize: 100,
  entranceSize: 100,
  sizeLabel: n => `${n} elements`,
  group: 'small',
  build: (_size, wasm) => buildSort(100, wasm),
}

// ---------------------------------------------------------------------------
// SHA-256

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
])

function compress(h: Uint32Array, w: Uint32Array, buf: Uint8Array, end: number): void {
  for (let off = 0; off < end; off += 64) {
    for (let t = 0; t < 16; t++) {
      const j = off + t * 4
      w[t] = (buf[j] << 24) | (buf[j + 1] << 16) | (buf[j + 2] << 8) | buf[j + 3]
    }
    for (let t = 16; t < 64; t++) {
      const x = w[t - 15]
      const y = w[t - 2]
      const s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3)
      const s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10)
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0
    }
    let a = h[0] | 0
    let b = h[1] | 0
    let c = h[2] | 0
    let d = h[3] | 0
    let e = h[4] | 0
    let f = h[5] | 0
    let g = h[6] | 0
    let hh = h[7] | 0
    for (let t = 0; t < 64; t++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))
      const ch = (e & f) ^ (~e & g)
      const t1 = (hh + S1 + ch + K[t] + w[t]) | 0
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const t2 = (S0 + maj) | 0
      hh = g
      g = f
      f = e
      e = (d + t1) | 0
      d = c
      c = b
      b = a
      a = (t1 + t2) | 0
    }
    h[0] = (h[0] + a) | 0
    h[1] = (h[1] + b) | 0
    h[2] = (h[2] + c) | 0
    h[3] = (h[3] + d) | 0
    h[4] = (h[4] + e) | 0
    h[5] = (h[5] + f) | 0
    h[6] = (h[6] + g) | 0
    h[7] = (h[7] + hh) | 0
  }
}

export function sha256Js(data: Uint8Array): Uint8Array {
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19])
  const w = new Uint32Array(64)
  const len = data.length
  const full = len - (len % 64)
  compress(h, w, data.subarray(0, full), full)

  const rest = len - full
  const tail = new Uint8Array(rest + 9 <= 64 ? 64 : 128)
  tail.set(data.subarray(full))
  tail[rest] = 0x80
  const view = new DataView(tail.buffer)
  view.setUint32(tail.length - 8, Math.floor(len / 0x20000000))
  view.setUint32(tail.length - 4, (len << 3) >>> 0)
  compress(h, w, tail, tail.length)

  const out = new Uint8Array(32)
  const outView = new DataView(out.buffer)
  for (let i = 0; i < 8; i++) outView.setUint32(i * 4, h[i])
  return out
}

const sha256: Workload = {
  id: 'sha256',
  label: 'SHA-256',
  defaultSize: 1,
  minSize: 1,
  maxSize: 64,
  entranceSize: 1,
  sizeLabel: n => `${n} MB`,
  group: 'crypto',
  build(megabytes, wasm) {
    const words = new Uint32Array((megabytes * 1024 * 1024) / 4)
    const rng = mulberry32(0x5ba256)
    for (let i = 0; i < words.length; i++) words[i] = rng() * 4294967296
    const data = new Uint8Array(words.buffer)
    const sides: Side<undefined, Uint8Array>[] = []
    if (wasm) sides.push({ id: 'rust', label: 'Rust', run: () => wasm.sha256(data) })
    sides.push({ id: 'js', label: 'JavaScript', run: () => sha256Js(data) })
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      sides.push({
        id: 'subtle',
        label: "The browser's crypto.subtle",
        run: async () => new Uint8Array(await crypto.subtle.digest('SHA-256', data as BufferSource)),
      })
    }
    return { sides, agree: agree.exact, preview: (digest: Uint8Array) => ({ digest }) }
  },
}

// ---------------------------------------------------------------------------
// Registry

export const workloads: Workload[] = [mandelbrot, nbody, matrix, sieve, sort, tinyCalls, stringsReverse, stringsCount, sortSmall, sha256]

export function getWorkload(id: string): Workload | undefined {
  return workloads.find(w => w.id === id)
}

// ---------------------------------------------------------------------------
// Message host shared by the worker and the main-thread fallback

export type HostMessage =
  | { type: 'status' }
  | { type: 'run'; id: number; workload: string; size: number }
  | { type: 'race'; id: number; workload: string; size: number }

function transferables(value: unknown): Transferable[] {
  if (!value || typeof value !== 'object') return []
  const buffers = new Set<ArrayBufferLike>()
  for (const v of ArrayBuffer.isView(value) ? [value] : Object.values(value)) {
    if (ArrayBuffer.isView(v)) buffers.add(v.buffer)
  }
  return [...buffers] as Transferable[]
}

// Gives each lane equal CPU time per turn (sliceMs), not equal work, so progress shows speed.
export async function runRace(
  lanes: { side: string; lane: RaceLane }[],
  onProgress: (side: string, fraction: number, chunk: unknown) => void,
  now: () => number = () => performance.now(),
  sliceMs = 8,
): Promise<void> {
  const done = lanes.map(() => 0)
  while (lanes.some((l, i) => done[i] < l.lane.units)) {
    lanes.forEach(({ side, lane }, i) => {
      if (done[i] >= lane.units) return
      const from = done[i]
      const start = now()
      do lane.step(done[i]++)
      while (done[i] < lane.units && now() - start < sliceMs)
      onProgress(side, done[i] / lane.units, lane.snapshot(from, done[i]))
    })
    await tick()
  }
}

export function createBenchHost(post: (message: unknown, transfer?: Transferable[]) => void) {
  let cancelled = false
  const ready = loadWasm().then(
    wasm => ({ wasm, error: undefined as string | undefined }),
    (e: unknown) => ({ wasm: null, error: e instanceof Error ? e.message : String(e) }),
  )

  return {
    cancel() {
      cancelled = true
    },
    async handle(msg: HostMessage): Promise<void> {
      const { wasm, error } = await ready
      if (msg.type === 'status') {
        post({ type: 'status', wasm: wasm !== null, error, info: wasmInfo() })
        return
      }
      cancelled = false
      try {
        const w = getWorkload(msg.workload)
        if (!w) throw new Error(`Unknown workload: ${msg.workload}`)
        const size = Math.min(w.maxSize, Math.max(w.minSize, Math.round(msg.size)))

        if (msg.type === 'race') {
          if (!w.race) throw new Error(`${w.label} has no race`)
          const lanes: ('rust' | 'js')[] = wasm ? ['rust', 'js'] : ['js']
          await runRace(
            lanes.map(side => ({ side, lane: w.race!(size, side, wasm) })),
            (side, fraction, chunk) => post({ type: 'progress', id: msg.id, side, fraction, chunk }, transferables(chunk)),
          )
          post({ type: 'result', id: msg.id, result: null })
          return
        }

        const built = w.build(size, wasm)
        const { output, ...result } = await measure(built.sides, {
          agree: built.agree,
          onSample: (side, ms, index) => post({ type: 'sample', id: msg.id, side, ms, index }),
          shouldCancel: () => cancelled,
        })
        const preview = built.preview(output)
        post({ type: 'result', id: msg.id, result: { ...result, workload: w.id, size, preview } }, transferables(preview))
      } catch (e) {
        post({ type: 'error', id: msg.id, message: e instanceof Error ? e.message : String(e) })
      }
    },
  }
}
