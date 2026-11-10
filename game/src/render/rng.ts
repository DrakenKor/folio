// Seeded randomness and noise for procedural scenery. Presentation-only: the
// simulation has its own RNG streams, and nothing here feeds back into it.

/** A mulberry32 stream: a fast 32-bit generator returning floats in [0, 1). */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Derives an independent seed for a named subsystem. */
export function subSeed(seed: number, name: string): number {
  let h = (seed ^ 0x811c9dc5) >>> 0
  for (let i = 0; i < name.length; i++) {
    h = Math.imul(h ^ name.charCodeAt(i), 0x01000193) >>> 0
  }
  return h
}

/**
 * 2D gradient noise with a seeded permutation, in roughly [-1, 1]. With a
 * `period`, lattice coordinates wrap so the noise tiles every `period` units.
 */
export class Noise2D {
  private readonly perm = new Uint16Array(512)
  private readonly gx = new Float32Array(256)
  private readonly gy = new Float32Array(256)

  constructor(seed: number) {
    const random = rng(seed)
    const p = new Uint16Array(256)
    for (let i = 0; i < 256; i++) p[i] = i
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(random() * (i + 1))
      const t = p[i]!
      p[i] = p[j]!
      p[j] = t
    }
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255]!
    for (let i = 0; i < 256; i++) {
      const a = random() * Math.PI * 2
      this.gx[i] = Math.cos(a)
      this.gy[i] = Math.sin(a)
    }
  }

  private grad(ix: number, iy: number, x: number, y: number): number {
    const h = this.perm[(this.perm[ix & 255]! + iy) & 511]!
    return this.gx[h]! * x + this.gy[h]! * y
  }

  sample(x: number, y: number, period = 0): number {
    const x0 = Math.floor(x)
    const y0 = Math.floor(y)
    const fx = x - x0
    const fy = y - y0
    let ix0 = x0
    let iy0 = y0
    let ix1 = x0 + 1
    let iy1 = y0 + 1
    if (period > 0) {
      ix0 = ((ix0 % period) + period) % period
      iy0 = ((iy0 % period) + period) % period
      ix1 = ((ix1 % period) + period) % period
      iy1 = ((iy1 % period) + period) % period
    }
    const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10)
    const v = fy * fy * fy * (fy * (fy * 6 - 15) + 10)
    const n00 = this.grad(ix0, iy0, fx, fy)
    const n10 = this.grad(ix1, iy0, fx - 1, fy)
    const n01 = this.grad(ix0, iy1, fx, fy - 1)
    const n11 = this.grad(ix1, iy1, fx - 1, fy - 1)
    const a = n00 + (n10 - n00) * u
    const b = n01 + (n11 - n01) * u
    return (a + (b - a) * v) * 1.414
  }

  /** Fractal sum of octaves, normalised to roughly [-1, 1]. */
  fbm(x: number, y: number, octaves: number, period = 0): number {
    let sum = 0
    let amp = 1
    let norm = 0
    let freq = 1
    for (let i = 0; i < octaves; i++) {
      sum += this.sample(x * freq, y * freq, period > 0 ? period * freq : 0) * amp
      norm += amp
      amp *= 0.5
      freq *= 2
    }
    return sum / norm
  }
}

export function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}
