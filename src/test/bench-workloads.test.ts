import nodeCrypto from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { mulberry32 } from '@/lib/bench'
import { getWorkload, runRace, sha256Js } from '@/lib/bench-workloads'
import { loadWasmFromDisk } from './helpers/wasm-from-disk'

const wasm = await loadWasmFromDisk()
const hasBinary = wasm !== null && typeof wasm.mandelbrot_rows === 'function' && typeof wasm.nbody === 'function'

const encoder = new TextEncoder()
const hex = (b: Uint8Array) => Buffer.from(b).toString('hex')

function bytes(n: number): Uint8Array {
  const rng = mulberry32(7)
  return Uint8Array.from({ length: n }, () => Math.floor(rng() * 256))
}

describe('sha256Js', () => {
  it('matches the known digest of "abc"', () => {
    expect(hex(sha256Js(encoder.encode('abc')))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })

  it('matches node:crypto across padding boundaries', () => {
    for (const n of [0, 55, 56, 64, 1000]) {
      const data = bytes(n)
      expect(hex(sha256Js(data))).toBe(nodeCrypto.createHash('sha256').update(data).digest('hex'))
    }
  })
})

describe.skipIf(!hasBinary)('JavaScript twins agree with the Rust binary', () => {
  const cases: [string, number][] = [
    ['mandelbrot', 64],
    ['nbody', 40],
    ['matrix', 24],
    ['sieve', 20_000],
    ['sort', 2_000],
    ['tiny-calls', 1_000],
    ['strings-reverse', 5_000],
    ['strings-count', 5_000],
  ]

  it.each(cases)('%s at size %i', async (id, size) => {
    const built = getWorkload(id)!.build(size, wasm)
    expect(built.sides.map(s => s.id)).toEqual(['rust', 'js'])
    const [rust, js] = await Promise.all(built.sides.map(s => s.run(s.prepare?.())))
    expect(built.agree(rust, js).ok).toBe(true)
  })

  it('sha256 matches at a few KB', () => {
    const data = bytes(3000)
    expect(hex(wasm!.sha256(data))).toBe(hex(sha256Js(data)))
  })
})

describe('runRace', () => {
  it('gives lanes equal time, so the cheaper engine finishes first', async () => {
    let t = 0
    const lane = (cost: number) => ({ units: 100, step: () => { t += cost }, snapshot: () => null })
    const events: [string, number][] = []
    await runRace([{ side: 'rust', lane: lane(1) }, { side: 'js', lane: lane(4) }], (side, f) => events.push([side, f]), () => t, 8)
    const rustDone = events.findIndex(([s, f]) => s === 'rust' && f === 1)
    const jsBefore = events.slice(0, rustDone).filter(([s]) => s === 'js').pop()!
    expect(rustDone).toBeGreaterThan(0)
    expect(jsBefore[1]).toBeLessThan(1)
    expect(events.at(-1)).toEqual(['js', 1])
  })
})
