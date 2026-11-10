// One sunlit palette for standing blades and continuous painted grass.
import type { Node, Texture } from 'three/webgpu'
import { color, dFdx, dFdy, dot, float, mix, smoothstep, texture, vec2, vec3 } from 'three/tsl'
import type { Environment } from '../materials/environment'

/** Broad palette variation shared by standing blades and painted ground. */
export function meadowPatch(env: Environment, xz: Node<'vec2'>, vertexStage = false): Node<'float'> {
  const broad = texture(env.noise, xz.div(160))
  const b = vertexStage ? broad.level(float(0)).r : broad.r
  return b.sub(0.5).mul(0.8).add(0.5)
}

/** Root, body and warm tip tones shared at every distance. */
export function meadowTones(patch: Node<'float'>) {
  const base = mix(color('#3b6e31'), color('#5f8032'), patch)
  const body = mix(color('#68a03b'), color('#8aa83b'), patch)
  const tip = mix(color('#b3d463'), color('#d9d87a'), patch)
  return { base, body, tip, ground: mix(mix(base, body, 0.8), tip, 0.16) }
}

/** Blade colour from its shaded root to its sunlit tip. */
export function bladeTone(tones: ReturnType<typeof meadowTones>, t: Node<'float'>): Node<'vec3'> {
  return mix(mix(tones.base, tones.body, smoothstep(0, 0.5, t)), tones.tip, smoothstep(0.45, 1, t))
}

/** Drier, yellower grass for trampled ground. */
export function dryGrass(c: Node<'vec3'>, amount: Node<'float'>): Node<'vec3'> {
  const luma = dot(c, vec3(0.2126, 0.7152, 0.0722)).toVar()
  return mix(c, vec3(luma).mul(vec3(1.18, 1.01, 0.62)), amount.mul(0.22))
}

/** Mipmapped directional strokes blend in scale as their pixel footprint grows. */
export function groundGrass(env: Environment, paint: Texture, xz: Node<'vec2'>, patch: Node<'float'>, clearing: Node<'float'>): Node<'vec3'> {
  const tones = meadowTones(patch)
  const direction = env.windDirection
  const uv = vec2(xz.dot(vec2(direction.y.negate(), direction.x)), xz.dot(direction))
  const footprint = dFdx(xz).length().max(dFdy(xz).length()).toVar()
  const fine = texture(paint, uv.div(8)).rg
  const middle = texture(paint, uv.div(28).add(0.37)).rg
  const broad = texture(paint, uv.div(76).add(0.71)).rg
  const detail = mix(middle, fine, smoothstep(0.025, 0.12, footprint).oneMinus())
  const marks = mix(detail, broad, smoothstep(0.18, 0.7, footprint)).toVar()
  const calm = clearing.mul(0.35).oneMinus()
  const c = mix(tones.ground, tones.base, marks.r.mul(0.5).mul(calm))
  return mix(c, mix(tones.body, tones.tip, 0.82), marks.g.mul(0.9).mul(calm))
}
