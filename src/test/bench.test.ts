import { describe, expect, it } from 'vitest'
import { measure } from '@/lib/bench'
import type { Side } from '@/lib/bench'

// A virtual clock: each run advances it by its own cost, so nothing really waits.
function clock() {
  let t = 0
  return { now: () => t, advance: (ms: number) => { t += ms } }
}

describe('measure', () => {
  it('reports a median per side and a verdict naming the faster one', async () => {
    const c = clock()
    const sides: Side<undefined, number>[] = [
      { id: 'rust', label: 'Rust', run: () => { c.advance(2); return 1 } },
      { id: 'js', label: 'JavaScript', run: () => { c.advance(5); return 1 } },
    ]
    const result = await measure(sides, { now: c.now })
    expect(result.valid).toBe(true)
    expect(result.stats.rust.median).toBeCloseTo(2)
    expect(result.stats.js.median).toBeCloseTo(5)
    expect(result.stats.rust.samples).toHaveLength(30)
    expect(result.faster).toBe('rust')
    expect(result.ratio).toBeCloseTo(2.5)
    expect(result.verdict).toBe('Rust 2.5x faster')
  })

  it('marks the result invalid, with no verdict, when outputs differ', async () => {
    const c = clock()
    const sides: Side<undefined, number>[] = [
      { id: 'rust', label: 'Rust', run: () => { c.advance(1); return 1 } },
      { id: 'js', label: 'JavaScript', run: () => { c.advance(1); return 2 } },
    ]
    const result = await measure(sides, { now: c.now, samples: 3 })
    expect(result.valid).toBe(false)
    expect(result.verdict).toBeNull()
  })

  it('batches a function too fast to time until a sample exceeds the minimum', async () => {
    const c = clock()
    const sides: Side<undefined, number>[] = [
      { id: 'rust', label: 'Rust', run: () => { c.advance(0.001); return 1 } },
      { id: 'js', label: 'JavaScript', run: () => { c.advance(0.002); return 1 } },
    ]
    const result = await measure(sides, { now: c.now })
    for (const stats of Object.values(result.stats)) {
      expect(stats.iterations).toBeGreaterThan(1)
      expect(stats.samples.every(ms => Number.isFinite(ms) && ms > 0)).toBe(true)
      expect(stats.median).toBeGreaterThan(0)
    }
    expect(result.stats.rust.iterations * 0.001).toBeGreaterThanOrEqual(20)
    expect(Number.isFinite(result.ratio)).toBe(true)
  })
})
