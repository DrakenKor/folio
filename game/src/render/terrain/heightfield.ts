// The meadow's shape: a seeded heightfield in a bowl of hills, a worn path
// winding through it, a flattened site for the monolith and a spot for the
// player. Pure data, computed once on the CPU; meshes and shaders read it.
import { DataTexture, DataUtils, HalfFloatType, LinearFilter, RGBAFormat, ClampToEdgeWrapping } from 'three/webgpu'
import { Noise2D, lerp, rng, smoothstep, subSeed } from '../rng'

export const TERRAIN_SIZE = 256
export const TERRAIN_HALF = TERRAIN_SIZE / 2
/** Samples per side: one per metre, corners included. */
export const GRID = TERRAIN_SIZE + 1

export interface Point {
  x: number
  z: number
}

export interface Heightfield {
  seed: number
  heights: Float32Array
  /** 1 on the path's centre line, fading to 0 at its worn edges. */
  path: Float32Array
  /** 0..1 grass density: none on the path or the monolith platform. */
  grass: Float32Array
  /** Path centre line, sampled densely from start to end. */
  pathLine: Point[]
  monolith: Point & { y: number }
  player: Point
  heightAt(x: number, z: number): number
  pathAt(x: number, z: number): number
  grassAt(x: number, z: number): number
  /** RGBA half-float: height, path, grass, unused. Texel i sits at x = i - 128. */
  texture: DataTexture
}

const PATH_HALF_WIDTH = 1.25

export function createHeightfield(seed: number): Heightfield {
  const random = rng(subSeed(seed, 'layout'))
  const noise = new Noise2D(subSeed(seed, 'height'))
  const jitter = (r: number) => (random() * 2 - 1) * r

  const monolith = { x: 26 + jitter(5), z: -30 + jitter(5), y: 0 }
  const player = { x: -6 + jitter(2), z: 18 + jitter(2) }

  // Path from the southern hills, past the player, to the monolith, then away north-west.
  const controls: Point[] = [
    { x: -20 + jitter(8), z: 140 },
    { x: -14 + jitter(6), z: 92 },
    { x: player.x + 3.2, z: player.z + 14 },
    { x: player.x + 3.0, z: player.z - 1 },
    { x: 6 + jitter(4), z: -6 + jitter(4) },
    { x: monolith.x - 8, z: monolith.z + 9 },
    { x: monolith.x - 9, z: monolith.z - 6 },
    { x: -18 + jitter(8), z: -70 + jitter(6) },
    { x: -48 + jitter(8), z: -140 }
  ]
  const pathLine = catmullRom(controls, 24)

  const base = (x: number, z: number) => {
    let h = noise.fbm(x / 80, z / 80, 4) * 4.5 + noise.fbm(x / 22 + 17, z / 22 - 9, 3) * 0.9
    // A bowl of hills hides the edge of the world.
    const edge = Math.max(Math.abs(x), Math.abs(z)) * 0.7 + Math.hypot(x, z) * 0.3
    h += smoothstep(58, 124, edge) * (16 + noise.fbm(x / 45 - 40, z / 45 + 3, 3) * 10)
    // A broad shoulder behind the monolith frames it from the meadow.
    h += 9 * Math.exp(-((x - 62) ** 2 + (z + 78) ** 2) / (2 * 34 * 34))
    h += 5 * Math.exp(-((x + 70) ** 2 + (z + 30) ** 2) / (2 * 28 * 28))
    return h
  }

  const heights = new Float32Array(GRID * GRID)
  const path = new Float32Array(GRID * GRID)
  const grass = new Float32Array(GRID * GRID)
  monolith.y = base(monolith.x, monolith.z) + 0.25

  for (let j = 0; j < GRID; j++) {
    for (let i = 0; i < GRID; i++) {
      const x = i - TERRAIN_HALF
      const z = j - TERRAIN_HALF
      const k = j * GRID + i
      let h = base(x, z)
      const d = distanceToLine(pathLine, x, z)
      const wobble = noise.sample(x / 6 + 100, z / 6) * 0.35
      const p = smoothstep(PATH_HALF_WIDTH + 1.1 + wobble, PATH_HALF_WIDTH * 0.35, d)
      // The path wears a shallow trough and smooths out small bumps.
      const smooth = noise.fbm(x / 80, z / 80, 4) * 4.5 + (h - noise.fbm(x / 80, z / 80, 4) * 4.5) * 0.6
      h = lerp(h, smooth - 0.12, smoothstep(PATH_HALF_WIDTH + 2.5, 0, d))
      // The monolith stands on levelled ground.
      const dm = Math.hypot(x - monolith.x, z - monolith.z)
      h = lerp(h, monolith.y - 0.25, smoothstep(13, 6.5, dm))
      heights[k] = h
      path[k] = p
      grass[k] = (1 - smoothstep(0.15, 0.75, p)) * smoothstep(5.2, 6.4, dm)
    }
  }

  const sampleGrid = (field: Float32Array, x: number, z: number) => {
    const fx = Math.min(Math.max(x + TERRAIN_HALF, 0), TERRAIN_SIZE - 1e-4)
    const fz = Math.min(Math.max(z + TERRAIN_HALF, 0), TERRAIN_SIZE - 1e-4)
    const i = Math.floor(fx)
    const j = Math.floor(fz)
    const u = fx - i
    const v = fz - j
    const a = field[j * GRID + i]!
    const b = field[j * GRID + i + 1]!
    const c = field[(j + 1) * GRID + i]!
    const e = field[(j + 1) * GRID + i + 1]!
    return lerp(lerp(a, b, u), lerp(c, e, u), v)
  }

  const data = new Uint16Array(GRID * GRID * 4)
  for (let k = 0; k < GRID * GRID; k++) {
    data[k * 4] = DataUtils.toHalfFloat(heights[k]!)
    data[k * 4 + 1] = DataUtils.toHalfFloat(path[k]!)
    data[k * 4 + 2] = DataUtils.toHalfFloat(grass[k]!)
    data[k * 4 + 3] = DataUtils.toHalfFloat(0)
  }
  const texture = new DataTexture(data, GRID, GRID, RGBAFormat, HalfFloatType)
  texture.magFilter = texture.minFilter = LinearFilter
  texture.wrapS = texture.wrapT = ClampToEdgeWrapping
  texture.generateMipmaps = false
  texture.needsUpdate = true

  return {
    seed,
    heights,
    path,
    grass,
    pathLine,
    monolith,
    player,
    heightAt: (x, z) => sampleGrid(heights, x, z),
    pathAt: (x, z) => sampleGrid(path, x, z),
    grassAt: (x, z) => sampleGrid(grass, x, z),
    texture
  }
}

function catmullRom(points: Point[], steps: number): Point[] {
  const out: Point[] = []
  for (let s = 0; s < points.length - 1; s++) {
    const p0 = points[Math.max(s - 1, 0)]!
    const p1 = points[s]!
    const p2 = points[s + 1]!
    const p3 = points[Math.min(s + 2, points.length - 1)]!
    for (let k = 0; k < steps; k++) {
      const t = k / steps
      const t2 = t * t
      const t3 = t2 * t
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)
      out.push({ x: f(p0.x, p1.x, p2.x, p3.x), z: f(p0.z, p1.z, p2.z, p3.z) })
    }
  }
  out.push(points[points.length - 1]!)
  return out
}

export function distanceToLine(line: Point[], x: number, z: number): number {
  let best = Infinity
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i]!
    const b = line[i + 1]!
    const dx = b.x - a.x
    const dz = b.z - a.z
    const len2 = dx * dx + dz * dz
    const t = len2 > 0 ? Math.min(1, Math.max(0, ((x - a.x) * dx + (z - a.z) * dz) / len2)) : 0
    const px = a.x + dx * t - x
    const pz = a.z + dz * t - z
    const d2 = px * px + pz * pz
    if (d2 < best) best = d2
  }
  return Math.sqrt(best)
}
