/* eslint-disable no-restricted-properties -- Native Math is the accuracy oracle, never simulation code. */
import { describe, expect, it } from 'vitest'
import { fmath } from './fmath'

function accurate(actual: number, expected: number) {
  const tolerance = Math.abs(expected) < 1e-5 ? 1e-12 : Math.abs(expected) * 1e-7
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance)
}

describe('fixed polynomial math', () => {
  it('matches native references on 10,000 fixed inputs and repeats bit for bit', () => {
    for (let i = 0; i < 10_000; i++) {
      const angle = (i - 5000) * 199.7193
      const x = (i - 5000) * 0.141
      const positive = Math.exp((i - 5000) * 0.14)
      const base = 0.01 + (i % 1000) / 50
      const power = (i % 41 - 20) / 3
      const args: Array<[number, number, number]> = [
        [fmath.sin(angle), Math.sin(angle), fmath.sin(angle)],
        [fmath.cos(angle), Math.cos(angle), fmath.cos(angle)],
        [fmath.atan2(i - 3333, 5000 - i), Math.atan2(i - 3333, 5000 - i), fmath.atan2(i - 3333, 5000 - i)],
        [fmath.exp(x), Math.exp(x), fmath.exp(x)],
        [fmath.log(positive), Math.log(positive), fmath.log(positive)],
        [fmath.pow(base, power), Math.pow(base, power), fmath.pow(base, power)]
      ]
      for (const [actual, expected, repeated] of args) {
        accurate(actual, expected)
        expect(actual).toBe(repeated)
      }
    }
  })

  it('handles small results, large angles, subnormals and domain boundaries', () => {
    for (const x of [0, -0, 1e-15, -1e-10, Math.PI, Math.PI / 2, 1e20, -1e100, Number.MAX_VALUE]) {
      accurate(fmath.sin(x), Math.sin(x))
      accurate(fmath.cos(x), Math.cos(x))
    }
    for (const x of [-745, -710, -1e-12, 0, 1e-12, 709.78]) accurate(fmath.exp(x), Math.exp(x))
    for (const x of [Number.MIN_VALUE, 1e-310, 1 - 1e-12, 1, 1 + 1e-12, Number.MAX_VALUE]) {
      accurate(fmath.log(x), Math.log(x))
    }
    for (const y of [0, -0, 1, -1, Infinity, -Infinity]) {
      for (const x of [0, -0, 1, -1, Infinity, -Infinity]) {
        expect(fmath.atan2(y, x)).toBeCloseTo(Math.atan2(y, x), 12)
      }
    }
    for (const [x, y] of [[-2, 3], [-2, -4], [0, 2], [0, -1], [NaN, 0], [1, Infinity], [-2, 0.5]]) {
      const actual = fmath.pow(x!, y!)
      const expected = Math.pow(x!, y!)
      if (Number.isFinite(expected)) accurate(actual, expected)
      else expect(actual).toBe(expected)
    }
    expect(fmath.sin(Infinity)).toBeNaN()
    expect(fmath.cos(NaN)).toBeNaN()
    expect(fmath.log(-1)).toBeNaN()
    expect(fmath.log(0)).toBe(-Infinity)
    expect(fmath.exp(Infinity)).toBe(Infinity)
    expect(fmath.exp(-Infinity)).toBe(0)
  })
})
