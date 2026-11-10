// The meadow's colours, shared by the blades and the ground grass so the two
// read as one surface at every distance, and the painted ground grass itself.
import type { Node } from 'three/webgpu'
import { color, cos, dFdx, dFdy, dot, float, floor, hash, mix, sin, smoothstep, texture, vec2, vec3 } from 'three/tsl'
import type { Environment } from '../materials/environment'
import { clumpGrowth, tuftCover } from '../foliage/tufts'

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
  const base = mix(color('#3e5c4b'), color('#53694f'), patch)
  const body = mix(color('#618659'), color('#799763'), patch)
  const tip = mix(color('#9eb987'), color('#abb684'), patch)
  return { base, body, tip, ground: mix(mix(base, body, 0.8), tip, 0.12) }
}

/** Blade colour from root (t = 0) to tip (t = 1): darker and cooler low, lighter and warmer high. */
export function bladeTone(tones: ReturnType<typeof meadowTones>, t: Node<'float'>): Node<'vec3'> {
  return mix(mix(tones.base, tones.body, smoothstep(0, 0.5, t)), tones.tip, smoothstep(0.45, 1, t))
}

/** Lighter, cooler grass where a gust presses it over and turns its paler side up. */
export function gustSheen(c: Node<'vec3'>, gust: Node<'float'>): Node<'vec3'> {
  const pressed = c.mul(vec3(1.04, 1.2, 1.34))
  return mix(c, pressed, gust.clamp(0, 1))
}

/** Drier, yellower grass at about the same value, for trampled ground. */
export function dryGrass(c: Node<'vec3'>, amount: Node<'float'>): Node<'vec3'> {
  const luma = dot(c, vec3(0.2126, 0.7152, 0.0722)).toVar()
  return mix(c, vec3(luma).mul(vec3(1.18, 1.01, 0.62)), amount.mul(0.22))
}

/**
 * Painted ground grass: the blades' average colour in soft clump patches at
 * three scales, a dark contact patch under each near tuft and short,
 * low-contrast marks, with the gust sheen carried by that detail. Detail fades
 * towards its mean as the pixel footprint grows, so far ground never shimmers.
 * `near` is 1 where blades stand over the ground; `clearing` calms the detail.
 */
export function groundGrass(env: Environment, xz: Node<'vec2'>, patch: Node<'float'>, gust: Node<'float'>, near: Node<'float'>, clearing: Node<'float'>): Node<'vec3'> {
  const tones = meadowTones(patch)
  const footprint = dFdx(xz).length().max(dFdy(xz).length()).toVar()
  // 1 while a feature of `size` metres spans several pixels.
  const resolved = (size: number) => smoothstep(size * 0.08, size * 0.3, footprint).oneMinus()
  const calm = clearing.mul(0.7).oneMinus()
  // Clump patches about 9 m, 3 m and 0.5 m across: lighter and warmer, or
  // darker and cooler. The middle scale is the tufts' own growth, lush and dark.
  const large = smoothstep(0.38, 0.62, texture(env.noise, xz.div(36)).r)
  const sparse = clumpGrowth(env, xz).oneMinus()
  const small = smoothstep(0.36, 0.64, texture(env.noise, xz.div(22)).b).toVar()
  const lift = large.sub(0.5).mul(0.18)
    .add(sparse.sub(0.5).mul(0.18).mul(resolved(2.5)))
    .add(small.sub(0.5).mul(0.06).mul(resolved(0.5)))
  let c = tones.ground.add(tones.tip.sub(tones.base).mul(lift.mul(calm)))
  // Blades shade the ground at their roots, so each near tuft stands on its own dark patch.
  c = mix(c, tones.base.mul(0.9), tuftCover(env, xz).mul(near).mul(resolved(0.4)).mul(0.5))
  // Short marks a little off the wind, each turned its own way.
  const dir = env.windDirection
  const uv = vec2(xz.dot(vec2(dir.y.negate(), dir.x)).div(0.2), xz.dot(dir).div(0.3)).toVar()
  const cell = floor(uv).toVar()
  const seed = cell.x.toInt().mul(8192).add(cell.y.toInt()).toVar()
  const offset = uv.sub(cell).sub(0.5).sub(vec2(hash(seed), hash(seed.add(71))).sub(0.5).mul(0.6))
  const turn = hash(seed.add(29)).sub(0.5).mul(1.4)
  const local = vec2(offset.x.mul(cos(turn)).sub(offset.y.mul(sin(turn))), offset.x.mul(sin(turn)).add(offset.y.mul(cos(turn)))).toVar()
  const aa = dFdx(uv).length().max(dFdy(uv).length()).mul(0.65).max(0.001).toVar()
  const width = smoothstep(-0.25, 0.4, local.y).oneMinus().mul(0.14)
  const mark = smoothstep(-0.4, -0.25, local.y)
    .mul(smoothstep(0.25, 0.4, local.y).oneMinus())
    .mul(smoothstep(width.sub(aa), width.add(aa), local.x.abs()).oneMinus())
    .mul(resolved(0.3)).toVar()
  const paint = mix(tones.body, tones.tip, smoothstep(-0.3, 0.3, local.y).mul(0.4))
  c = mix(c, paint, mark.mul(0.22).mul(calm))
  // The gust rides the detail, so it reads as pressed strokes rather than a wash.
  return gustSheen(c, gust.mul(small.mul(0.5).add(mark.mul(0.3)).add(0.45)).mul(clearing.mul(0.85).oneMinus()))
}
