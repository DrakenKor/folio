// The meadow's colours, shared by the blades and the ground grass so the two
// read as one surface at every distance, and the painted ground grass itself.
import type { Node } from 'three/webgpu'
import { color, dFdx, dFdy, dot, float, mix, smoothstep, texture, vec2, vec3 } from 'three/tsl'
import type { Environment } from '../materials/environment'

/** Patch value 0..1 at a ground position: large soft areas of yellower (high) and bluer grass. */
export function meadowPatch(env: Environment, xz: Node<'vec2'>, vertexStage = false): Node<'float'> {
  const low = texture(env.noise, xz.div(110))
  const mid = texture(env.noise, xz.div(31))
  const l = vertexStage ? low.level(float(0)).r : low.r
  const m = vertexStage ? mid.level(float(0)).g : mid.g
  return smoothstep(0.3, 0.7, l.add(m.sub(0.5).mul(0.5)))
}

/**
 * Meadow tones for a patch value: blade roots, body and sunlit tips, and the
 * ground grass, which is the blades' average colour so fading blades leave no hole.
 */
export function meadowTones(patch: Node<'float'>) {
  const base = mix(color('#36603a'), color('#4f6e30'), patch)
  const body = mix(color('#5c933a'), color('#86a23c'), patch)
  const tip = mix(color('#b0cf62'), color('#d9d67a'), patch)
  return { base, body, tip, ground: mix(body, tip, 0.22) }
}

/** Blade colour from root (t = 0) to tip (t = 1): darker and cooler low, lighter and warmer high. */
export function bladeTone(tones: ReturnType<typeof meadowTones>, t: Node<'float'>): Node<'vec3'> {
  return mix(mix(tones.base, tones.body, smoothstep(0, 0.5, t)), tones.tip, smoothstep(0.45, 1, t))
}

/** Lighter, cooler grass where a gust presses it over and turns its paler side up. */
export function gustSheen(c: Node<'vec3'>, gust: Node<'float'>): Node<'vec3'> {
  return mix(c, mix(c, color('#d6ecd0'), 0.55), gust.mul(0.55))
}

/** Drier, yellower grass at about the same value, for trampled ground. */
export function dryGrass(c: Node<'vec3'>, amount: Node<'float'>): Node<'vec3'> {
  const luma = dot(c, vec3(0.2126, 0.7152, 0.0722))
  return mix(c, vec3(luma).mul(vec3(1.18, 1.05, 0.62)), amount.mul(0.45))
}

/**
 * Painted ground grass: the blades' average colour broken by clump patches and
 * fine strokes lying downwind, with the gust sheen. Detail fades towards its
 * mean as the pixel footprint grows, so far ground never shimmers or blotches.
 */
export function groundGrass(env: Environment, xz: Node<'vec2'>, patch: Node<'float'>, gust: Node<'float'>): Node<'vec3'> {
  const tones = meadowTones(patch)
  const footprint = dFdx(xz).length().max(dFdy(xz).length())
  const dir = env.windDirection
  const along = xz.dot(dir)
  const across = xz.dot(vec2(dir.y.negate(), dir.x))
  // Clump patches about a metre across.
  const clumpNoise = texture(env.noise, xz.div(13)).g
  const clumps = mix(float(0.5), smoothstep(0.32, 0.68, clumpNoise), smoothstep(0.04, 0.25, footprint).oneMinus())
  // Strokes thin across the wind and long along it, slightly wavy.
  const strokeNoise = texture(env.noise, vec2(across.add(clumpNoise.mul(0.6)).div(5), along.div(22))).b
  const strokes = mix(float(0.5), smoothstep(0.36, 0.64, strokeNoise), smoothstep(0.012, 0.055, footprint).oneMinus())
  let c = tones.ground.mul(clumps.sub(0.5).mul(0.24).add(1))
  c = c.add(tones.tip.sub(tones.base).mul(strokes.sub(0.5).mul(0.42)))
  return gustSheen(c, gust)
}
