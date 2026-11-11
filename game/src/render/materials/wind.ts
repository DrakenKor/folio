// One wind field for grass, ground, trees and cloth: a heading, a slow base
// sway and soft gust bands travelling downwind, so a gust visibly rolls
// through all of them together. Every read uses texture level 0, so the same
// calls work in vertex and fragment stages.
import type { Node } from 'three/webgpu'
import { float, mod, sin, smoothstep, texture, vec2 } from 'three/tsl'
import type { Environment } from './environment'

/** Metres per second the gust bands travel downwind. */
export const GUST_SPEED = 6

/** Gust strength 0..1 at a ground position: soft bands, long across the wind, travelling downwind. */
export function gustAt(env: Environment, xz: Node<'vec2'>): Node<'float'> {
  const dir = env.windDirection
  const along = xz.dot(dir).sub(env.time.mul(GUST_SPEED))
  const across = xz.dot(vec2(dir.y.negate(), dir.x))
  const warp = texture(env.noise, vec2(across.div(300), float(0.37))).level(float(0)).r.sub(0.5).mul(11)
    .add(sin(across.mul(0.025)).mul(5))
  const front = mod(along.add(warp).add(24), 72).toVar()
  // Soft shoulders keep the travelling front from reading as a straight stripe; the crest holds a few metres.
  return smoothstep(0, 10, front).mul(smoothstep(14, 30, front).oneMinus())
}

/** Wind at a ground position: the gust 0..1 and the downwind lean it causes, base sway included. */
export function windAt(env: Environment, xz: Node<'vec2'>) {
  const gust = gustAt(env, xz).toVar()
  const sway = sin(env.time.mul(1.7).sub(xz.dot(env.windDirection).mul(0.22))).mul(0.5).add(0.5)
  const lean = env.windStrength.mul(sway.mul(0.35).add(0.32).add(gust.mul(0.95)))
  return { gust, lean }
}
