// One clump field and palette for standing and painted grass.
import type { Node } from 'three/webgpu'
import { cameraPosition, color, dFdx, dFdy, dot, float, mix, smoothstep, texture, vec3 } from 'three/tsl'
import type { Environment } from '../materials/environment'
import { clumpGrowth, tuftPaint } from '../foliage/tufts'

/** Lushness shared by the ground colour and tuft growth. */
export function meadowPatch(env: Environment, xz: Node<'vec2'>, vertexStage = false): Node<'float'> {
  const detail = smoothstep(24, 85, xz.distance(cameraPosition.xz)).oneMinus()
  const broad = texture(env.noise, xz.div(160))
  const middle = texture(env.noise, xz.div(80))
  const b = vertexStage ? broad.level(float(0)).r : broad.r
  const m = vertexStage ? middle.level(float(0)).r : middle.r
  const distant = smoothstep(0.35, 0.65, b.mul(0.6).add(m.mul(0.4))).sub(0.5).mul(0.6).add(0.5)
  return mix(distant, clumpGrowth(env, xz, vertexStage), detail)
}

/** Dry gaps and lush clumps share root, body and tip tones at every distance. */
export function meadowTones(patch: Node<'float'>) {
  const base = mix(color('#697653'), color('#405f4c'), patch)
  const body = mix(color('#919e6a'), color('#698b5b'), patch)
  const tip = mix(color('#b0b581'), color('#93ac78'), patch)
  return { base, body, tip, ground: mix(mix(base, body, 0.8), tip, 0.12) }
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

/** Painted clumps keep their palette and pattern as individual strokes recede. */
export function groundGrass(env: Environment, xz: Node<'vec2'>, patch: Node<'float'>, clearing: Node<'float'>): Node<'vec3'> {
  const tones = meadowTones(patch)
  const footprint = dFdx(xz).length().max(dFdy(xz).length()).toVar()
  const resolved = (size: number) => smoothstep(size * 0.08, size * 0.3, footprint).oneMinus()
  const calm = clearing.mul(0.55).oneMinus()
  const large = smoothstep(0.38, 0.62, texture(env.noise, xz.div(160)).r)
  let c = tones.ground.mul(large.sub(0.5).mul(0.06).add(1))
  const paint = tuftPaint(env, xz)
  const tuft = paint.cover.mul(resolved(0.4)).toVar()
  c = mix(c, tones.base, tuft.mul(0.3).mul(calm))
  const mark = paint.strokes.mul(resolved(0.4)).toVar()
  c = mix(c, mix(tones.body, tones.tip, 0.25), mark.mul(0.5).mul(calm))
  // Larger brush marks survive behind the standing blades without changing the grass palette.
  const middle = tuftPaint(env, xz.div(3))
  const brush = middle.strokes.mul(resolved(1.2)).toVar()
  c = mix(c, tones.body, brush.mul(0.32).mul(calm))
  return c
}
