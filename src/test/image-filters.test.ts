import { describe, expect, it } from 'vitest'
import { filterCall, runJs, runRust, type FilterId } from '@/lib/image-filters'
import { loadWasmFromDisk } from './helpers/wasm-from-disk'

const wasm = await loadWasmFromDisk()

const FILTERS: Array<[FilterId, number]> = [
  ['blur', 5], ['sharpen', 1.5], ['edges', 0], ['emboss', 1], ['greyscale', 0],
  ['sepia', 0], ['invert', 0], ['brightness', 0.3], ['contrast', -0.4], ['custom', 0],
]
const CUSTOM = { ksize: 5, divisor: 25, kernel: Array.from({ length: 25 }, (_, i) => (i % 3) + 0.5) }
const call = (id: FilterId, amount: number) => filterCall(id, amount, CUSTOM)

function fixture(w: number, h: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(w * h * 4)
  let s = 12345
  for (let i = 0; i < data.length; i++) {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0
    data[i] = s >>> 24
  }
  return data
}

function maxDiff(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  let m = 0
  for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i]))
  return m
}

describe('image filters', () => {
  it.skipIf(!wasm)('Rust and JS agree within 1 per channel for every filter on 64x64', () => {
    for (const [id, amount] of FILTERS) {
      const js = fixture(64, 64)
      const rust = fixture(64, 64)
      runJs(call(id, amount), js, 64, 64)
      runRust(wasm!, call(id, amount), rust, 64, 64)
      expect(maxDiff(js, rust), id).toBeLessThanOrEqual(1)
      expect(maxDiff(js, fixture(64, 64)), `${id} changes the image`).toBeGreaterThan(0)
    }
  })

  it('a 1x1 image survives every filter; normalised and blur-type filters leave it unchanged', () => {
    const unchanged: FilterId[] = ['blur', 'sharpen', 'emboss', 'custom']
    const engines = [(c: ReturnType<typeof call>, d: Uint8ClampedArray) => runJs(c, d, 1, 1)]
    if (wasm) engines.push((c, d) => runRust(wasm, c, d, 1, 1))
    for (const run of engines) {
      for (const [id, amount] of FILTERS) {
        const d = new Uint8ClampedArray([200, 100, 50, 77])
        const c = id === 'custom' ? filterCall('custom', 0, { kernel: [0, 0, 0, 0, 1, 0, 0, 0, 0], ksize: 3, divisor: 1 }) : call(id, amount)
        expect(() => run(c, d)).not.toThrow()
        expect(d[3]).toBe(77)
        if (unchanged.includes(id)) expect(Array.from(d), id).toEqual([200, 100, 50, 77])
      }
    }
  })

  it('a divisor of 0 behaves as 1', () => {
    const k = [0, -1, 0, -1, 5, -1, 0, -1, 0]
    const a = fixture(16, 16)
    const b = fixture(16, 16)
    runJs({ primitive: 'convolve', kernel: k, ksize: 3, divisor: 0, bias: 0 }, a, 16, 16)
    runJs({ primitive: 'convolve', kernel: k, ksize: 3, divisor: 1, bias: 0 }, b, 16, 16)
    expect(Array.from(a)).toEqual(Array.from(b))
    if (wasm) {
      const c = fixture(16, 16)
      runRust(wasm, { primitive: 'convolve', kernel: k, ksize: 3, divisor: 0, bias: 0 }, c, 16, 16)
      expect(maxDiff(a, c)).toBeLessThanOrEqual(1)
    }
  })

  it('never modifies alpha, including the outer ring after sharpen and edges', () => {
    const w = 12
    const h = 9
    const before = fixture(w, h)
    const engines = [(c: ReturnType<typeof call>, d: Uint8ClampedArray) => runJs(c, d, w, h)]
    if (wasm) engines.push((c, d) => runRust(wasm, c, d, w, h))
    for (const run of engines) {
      for (const [id, amount] of FILTERS) {
        const d = fixture(w, h)
        run(call(id, amount), d)
        for (let p = 0; p < w * h; p++) {
          const x = p % w
          const y = Math.floor(p / w)
          const ring = x === 0 || y === 0 || x === w - 1 || y === h - 1
          expect(d[p * 4 + 3], `${id} alpha at ${x},${y} (ring ${ring})`).toBe(before[p * 4 + 3])
        }
      }
    }
  })

  describe.skipIf(!wasm)('Rust build present', () => {
    it('rejects mismatched buffers without touching them', () => {
      const d = new Uint8Array([1, 2, 3, 4])
      wasm!.sobel(d, 5, 5)
      wasm!.gaussian_blur(d, 1, 1, -1)
      expect(Array.from(d)).toEqual([1, 2, 3, 4])
    })
  })
})
