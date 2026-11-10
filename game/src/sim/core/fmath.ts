const PI = 3.141592653589793
const HALF_PI = 1.5707963267948966
const QUARTER_PI = 0.7853981633974483
const LN2 = 0.6931471805599453
const bits = new DataView(new ArrayBuffer(8))

// floor(2 / pi * 2^1280), sufficient to reduce every finite binary64 angle.
const TWO_OVER_PI = 0xa2f9836e4e441529fc2757d1f534ddc0db6295993c439041fe5163abdebbc561b7246e3a424dd2e006492eea09d1921cfe1deb1cb129a73ee88235f52ebb4484e99c7026b45f7e413991d639835339f49c845f8bbdf9283b1ff897ffde05980fef2f118b5a0a6d1f6d367ecf27cb09b74f463f669e5fea2d7527bac7ebe5f17b3d0739f78a5292ea6bfb5fb11f8d5d0856033046fc7b6babf0cfbc209af4361dn

const SIN = [1, -1 / 6, 1 / 120, -1 / 5040, 1 / 362880, -1 / 39916800, 1 / 6227020800, -1 / 1307674368000, 1 / 355687428096000]
const COS = [1, -1 / 2, 1 / 24, -1 / 720, 1 / 40320, -1 / 3628800, 1 / 479001600, -1 / 87178291200, 1 / 20922789888000, -1 / 6402373705728000]

function polynomial(x: number, coefficients: readonly number[]): number {
  let result = coefficients[coefficients.length - 1]!
  for (let i = coefficients.length - 2; i >= 0; i--) result = result * x + coefficients[i]!
  return result
}

function reduce(x: number): [number, number] {
  if (x <= 1_048_576) {
    const quadrant = Math.round(x / HALF_PI)
    // Split pi/2 keeps the first product exact in this range.
    return [quadrant % 4, (x - quadrant * 1.5707963267341256) - quadrant * 6.077100506506192e-11]
  }
  bits.setFloat64(0, x)
  const high = bits.getUint32(0)
  const mantissa = (BigInt(high & 0xfffff) << 32n) | BigInt(bits.getUint32(4)) | (1n << 52n)
  const exponent = (high >>> 20) - 1023 - 52
  const shift = BigInt(1280 - exponent)
  const product = mantissa * TWO_OVER_PI
  const quadrant = (product + (1n << (shift - 1n))) >> shift
  const fraction = Number((product - (quadrant << shift)) >> (shift - 64n)) / 18446744073709551616
  return [Number(quadrant & 3n), fraction * HALF_PI]
}

/** Sine using fixed Taylor polynomials and binary64 range reduction. */
export function sin(x: number): number {
  if (!Number.isFinite(x)) return NaN
  if (x === 0) return x
  const [quadrant, r] = reduce(Math.abs(x))
  const value = quadrant % 2 === 0 ? r * polynomial(r * r, SIN) : polynomial(r * r, COS)
  return (x < 0 ? -1 : 1) * (quadrant >= 2 ? -value : value)
}

/** Cosine using fixed Taylor polynomials and binary64 range reduction. */
export function cos(x: number): number {
  if (!Number.isFinite(x)) return NaN
  const [quadrant, r] = reduce(Math.abs(x))
  const value = quadrant % 2 === 0 ? polynomial(r * r, COS) : r * polynomial(r * r, SIN)
  return quadrant === 1 || quadrant === 2 ? -value : value
}

function atanUnit(x: number): number {
  const shifted = x > 0.41421356237309503
  const r = shifted ? (x - 1) / (x + 1) : x
  const square = r * r
  let p = -1 / 31
  for (let i = 14; i >= 0; i--) p = (i % 2 === 0 ? 1 : -1) / (2 * i + 1) + square * p
  return (shifted ? QUARTER_PI : 0) + r * p
}

/** Quadrant-aware angle, including signed zero and infinite axes. */
export function atan2(y: number, x: number): number {
  if (Number.isNaN(x) || Number.isNaN(y)) return NaN
  const negativeY = y < 0 || Object.is(y, -0)
  if (y === 0) return x < 0 || Object.is(x, -0) ? (negativeY ? -PI : PI) : y
  if (x === 0) return negativeY ? -HALF_PI : HALF_PI
  const ax = Math.abs(x)
  const ay = Math.abs(y)
  let angle: number
  if (ax === Infinity && ay === Infinity) angle = QUARTER_PI
  else angle = ay > ax ? HALF_PI - atanUnit(ax / ay) : atanUnit(ay / ax)
  if (x < 0) angle = PI - angle
  return negativeY ? -angle : angle
}

function twoTo(k: number): number {
  bits.setUint32(0, (k + 1023) << 20)
  bits.setUint32(4, 0)
  return bits.getFloat64(0)
}

/** Exponential with ln(2) range reduction and a fixed degree-14 polynomial. */
export function exp(x: number): number {
  if (Number.isNaN(x)) return NaN
  if (x > 709.782712893384) return Infinity
  if (x < -745.1332191019411) return 0
  const k = Math.round(x / LN2)
  const r = (x - k * 0.6931471803691238) - k * 1.9082149292705877e-10
  let p = 1
  for (let i = 14; i >= 1; i--) p = 1 + r * p / i
  if (k > 1023) return (p * 2) * twoTo(k - 1)
  if (k < -1022) return (p * twoTo(k + 1022)) * twoTo(-1022)
  return p * twoTo(k)
}

/** Natural logarithm using binary decomposition and a fixed atanh polynomial. */
export function log(x: number): number {
  if (x === 0) return -Infinity
  if (x < 0 || Number.isNaN(x)) return NaN
  if (x === Infinity) return Infinity
  let correction = 0
  if (x < 2.2250738585072014e-308) {
    x *= 4503599627370496
    correction = -52
  }
  bits.setFloat64(0, x)
  const high = bits.getUint32(0)
  let exponent = (high >>> 20) - 1023 + correction
  bits.setUint32(0, (high & 0xfffff) | 0x3ff00000)
  let mantissa = bits.getFloat64(0)
  if (mantissa > 1.4142135623730951) {
    mantissa /= 2
    exponent++
  }
  const r = (mantissa - 1) / (mantissa + 1)
  let p = 1 / 21
  for (let i = 9; i >= 0; i--) p = 1 / (2 * i + 1) + r * r * p
  return exponent * LN2 + 2 * r * p
}

/** Real power; negative bases require an integer exponent. */
export function pow(x: number, y: number): number {
  if (y === 0) return 1
  if (Number.isNaN(x) || Number.isNaN(y)) return NaN
  const absolute = Math.abs(x)
  if (!Number.isFinite(y)) {
    if (absolute === 1) return NaN
    return (absolute > 1) === (y > 0) ? Infinity : 0
  }
  const odd = Number.isInteger(y) && Math.abs(y % 2) === 1
  const sign = (x < 0 || Object.is(x, -0)) && odd ? -1 : 1
  if (absolute === 0) return sign * (y > 0 ? 0 : Infinity)
  if (absolute === Infinity) return sign * (y > 0 ? Infinity : 0)
  if (x < 0 && !Number.isInteger(y)) return NaN
  return sign * exp(y * log(absolute))
}

export const fmath = Object.freeze({ sin, cos, atan2, exp, log, pow })
