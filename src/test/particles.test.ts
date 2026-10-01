import { describe, expect, it } from 'vitest'
import { Raster, sampleHomes } from '../components/demo/particles/shapes'

// RGBA pixels from a grid of rows: '#' is light, '.' is dark
const raster = (rows: string[]): Raster => {
  const data = new Uint8ClampedArray(rows.join('').length * 4)
  rows.join('').split('').forEach((cell, i) => data.set(cell === '#' ? [209, 209, 209, 255] : [0, 0, 0, 255], i * 4))
  return { width: rows[0].length, height: rows.length, data }
}

describe('sampleHomes', () => {
  it('puts homes only on light pixels, in clip space with the aspect preserved', () => {
    const square = sampleHomes(raster(['..##', '..##', '....', '....']), 200, () => 0.5)
    for (let n = 0; n < 200; n++) {
      // The top right quadrant: x in (0, 1), y in (0, 1)
      expect(square.homes[n * 2]).toBeGreaterThan(0)
      expect(square.homes[n * 2 + 1]).toBeGreaterThan(0)
    }
    // Twice as wide as tall: the far column sits past 1, not squeezed into it
    const wide = sampleHomes(raster(['.......#', '........', '........', '........']), 1, () => 0.5)
    expect(wide.homes[0]).toBeCloseTo(1.75)
    expect(wide.homes[1]).toBeCloseTo(0.75)
  })

  it('puts every home at the centre when the source is all dark', () => {
    const { homes } = sampleHomes(raster(['....', '....']), 8)
    expect(Array.from(homes)).toEqual(new Array(16).fill(0))
  })
})
