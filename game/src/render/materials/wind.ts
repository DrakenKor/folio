// One wind field for grass, ground, trees and cloth: a heading, a slow base
// sway and soft gust bands travelling downwind, so a gust visibly rolls
// through all of them together. Every read uses texture level 0, so the same
// calls work in vertex and fragment stages.
import type { Node } from 'three/webgpu'
import { float, sin, smoothstep, texture, vec2 } from 'three/tsl'
import type { Environment } from './environment'

/** Metres per second the gust bands travel downwind. */
export const GUST_SPEED = 6

/** Gust strength 0..1 at a ground position: soft bands, long across the wind, travelling downwind. */
export function gustAt(env: Environment, xz: Node<'vec2'>): Node<'float'> {
  const dir = env.windDirection
  const along = xz.dot(dir).sub(env.time.mul(GUST_SPEED))
  const across = xz.dot(vec2(dir.y.negate(), dir.x))
  // Advected broad lobes break up the crosswind front without turning it into bright parallel ribbons.
  const patch = texture(env.noise, vec2(along.div(65), across.div(42))).level(float(0)).g
  const crest = sin(along.mul(0.087).add(sin(across.mul(0.055)).mul(1.5))).mul(0.5).add(0.5)
  return smoothstep(0.28, 0.94, crest).mul(smoothstep(0.22, 0.7, patch).mul(0.72).add(0.28))
}

/** Wind at a ground position: the gust 0..1 and the downwind lean it causes, base sway included. */
export function windAt(env: Environment, xz: Node<'vec2'>) {
  const gust = gustAt(env, xz).toVar()
  const sway = sin(env.time.mul(1.7).sub(xz.dot(env.windDirection).mul(0.22))).mul(0.5).add(0.5)
  const lean = env.windStrength.mul(sway.mul(0.35).add(0.32).add(gust.mul(0.95)))
  return { gust, lean }
}
