// The meadow's colours, shared by the blades and the ground grass so the two
// read as one surface at every distance, and the painted ground grass itself.
import type { Node } from 'three/webgpu'
import { color, dFdx, dFdy, dot, float, mix, smoothstep, texture, vec3 } from 'three/tsl'
import type { Environment } from '../materials/environment'
import { clumpGrowth, tuftPaint } from '../foliage/tufts'

/** Patch value 0..1 at a ground position: large soft areas of yellower (high) and bluer grass. */
export function meadowPatch(env: Environment, xz: Node<'vec2'>, vertexStage = false): Node<'float'> {
  const low = texture(env.noise, xz.div(240))
  const mid = texture(env.noise, xz.div(130))
  const l = vertexStage ? low.level(float(0)).r : low.r
  const m = vertexStage ? mid.level(float(0)).g : mid.g
  return smoothstep(0.3, 0.7, l.add(m.sub(0.5).mul(0.2)))
}

/**
 * Meadow tones for a patch value: blade roots, body and sunlit tips, and the
 * ground grass, which is the blades' average colour so fading blades leave no hole.
 */
export function meadowTones(patch: Node<'float'>) {
  const base = mix(color('#3e5c4b'), color('#53694f'), patch)
  const body = mix(color('#618659'), color('#799763'), patch)
  const tip = mix(color('#91ac78'), color('#a3b07c'), patch)
  return { base, body, tip, ground: mix(mix(base, body, 0.8), tip, 0.12) }
}

/** Blade colour from root (t = 0) to tip (t = 1): darker and cooler low, lighter and warmer high. */
export function bladeTone(tones: ReturnType<typeof meadowTones>, t: Node<'float'>): Node<'vec3'> {
  return mix(mix(tones.base, tones.body, smoothstep(0, 0.5, t)), tones.tip, smoothstep(0.45, 1, t))
}

/** Lighter, cooler grass where a gust presses it over and turns its paler side up. */
export function gustSheen(c: Node<'vec3'>, gust: Node<'float'>): Node<'vec3'> {
  const pressed = c.mul(vec3(1.12, 1.43, 1.62))
  return mix(c, pressed, gust.clamp(0, 1))
}

/** Drier, yellower grass at about the same value, for trampled ground. */
export function dryGrass(c: Node<'vec3'>, amount: Node<'float'>): Node<'vec3'> {
  const luma = dot(c, vec3(0.2126, 0.7152, 0.0722)).toVar()
  return mix(c, vec3(luma).mul(vec3(1.18, 1.01, 0.62)), amount.mul(0.22))
}

/** Three scales of painted clumps, sharing the standing tufts' strokes, colour and travelling wind. */
export function groundGrass(env: Environment, xz: Node<'vec2'>, patch: Node<'float'>, gust: Node<'float'>, near: Node<'float'>, clearing: Node<'float'>): Node<'vec3'> {
  const tones = meadowTones(patch)
  const footprint = dFdx(xz).length().max(dFdy(xz).length()).toVar()
  // 1 while a feature of `size` metres spans several pixels.
  const resolved = (size: number) => smoothstep(size * 0.08, size * 0.3, footprint).oneMinus()
  const calm = clearing.mul(0.7).oneMinus()
  // Clump patches about 30 m, 3 m and 0.5 m across: lighter and warmer, or
  // darker and cooler. The middle scale is the tufts' own growth, lush and dark.
  const large = smoothstep(0.38, 0.62, texture(env.noise, xz.div(120)).r)
  const sparse = clumpGrowth(env, xz).oneMinus()
  const small = smoothstep(0.36, 0.64, texture(env.noise, xz.div(22)).b).toVar()
  const lift = large.sub(0.5).mul(0.08)
    .add(sparse.sub(0.5).mul(0.10).mul(resolved(2.5)))
    .add(small.sub(0.5).mul(0.035).mul(resolved(0.5)))
  let c = tones.ground.add(tones.tip.sub(tones.base).mul(lift.mul(calm)))
  const paint = tuftPaint(env, xz)
  const tuft = paint.cover.mul(resolved(0.4)).toVar()
  c = mix(c, tones.base, tuft.mul(near.mul(0.15).add(0.2)))
  const mark = paint.strokes.mul(resolved(0.4)).toVar()
  c = mix(c, mix(tones.body, tones.tip, 0.35), mark.mul(0.65).mul(calm))
  const middle = tuftPaint(env, xz.div(8))
  const brush = middle.strokes.mul(resolved(3.2)).mul(near.mul(0.6).oneMinus()).toVar()
  c = mix(c, mix(tones.body, tones.tip, 0.55), brush.mul(0.45).mul(calm))
  // Resolved grass catches the gust on its strokes; distant grass reads as one pressed surface.
  const far = smoothstep(0.025, 0.16, footprint)
  const carrier = mix(mark.mul(0.4).add(tuft.mul(0.15)).add(0.04), float(0.95), far)
  return gustSheen(c, gust.mul(carrier).mul(clearing.mul(0.85).oneMinus()))
}
