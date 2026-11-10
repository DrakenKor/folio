// One wind field for grass, ground, trees and cloth: a heading, a slow base
// sway and soft gust bands travelling downwind, so a gust visibly rolls
// through all of them together. Every read uses texture level 0, so the same
// calls work in vertex and fragment stages.
import type { Node } from 'three/webgpu'
import { float, sin, smoothstep, texture, vec2 } from 'three/tsl'
import type { Environment } from './environment'

/** Metres per second the gust bands travel downwind. */
export const GUST_SPEED = 3.5

/** Gust strength 0..1 at a ground position: soft bands, long across the wind, travelling downwind. */
export function gustAt(env: Environment, xz: Node<'vec2'>): Node<'float'> {
  const dir = env.windDirection
  const along = xz.dot(dir).sub(env.time.mul(GUST_SPEED))
  const across = xz.dot(vec2(dir.y.negate(), dir.x))
  // About 30 m between fronts along the wind, 100 m long across it.
  const n = texture(env.noise, vec2(along.div(120), across.div(400))).level(float(0)).r
  return smoothstep(0.44, 0.64, n)
}

/** Wind at a ground position: the gust 0..1 and the downwind lean it causes, base sway included. */
export function windAt(env: Environment, xz: Node<'vec2'>) {
  const gust = gustAt(env, xz)
  const sway = sin(env.time.mul(0.9).sub(xz.dot(env.windDirection).mul(0.16))).mul(0.5).add(0.5)
  const lean = env.windStrength.mul(sway.mul(0.14).add(0.16).add(gust.mul(0.85)))
  return { gust, lean }
}
