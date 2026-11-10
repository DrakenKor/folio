// One wind field for grass, ground, trees and cloth: a heading, a slow base
// sway and soft gust bands travelling downwind, so a gust visibly rolls
// through all of them together. Every read uses texture level 0, so the same
// calls work in vertex and fragment stages.
import type { Node } from 'three/webgpu'
import { float, mod, sin, smoothstep, texture, vec2 } from 'three/tsl'
import type { Environment } from './environment'

/** Metres per second the gust bands travel downwind. */
export const GUST_SPEED = 3.5

/** Gust strength 0..1 at a ground position: soft bands, long across the wind, travelling downwind. */
export function gustAt(env: Environment, xz: Node<'vec2'>): Node<'float'> {
  const dir = env.windDirection
  const along = xz.dot(dir).sub(env.time.mul(GUST_SPEED))
  const across = xz.dot(vec2(dir.y.negate(), dir.x))
  const warp = texture(env.noise, vec2(across.div(300), float(0.37))).level(float(0)).r
  const front = mod(along.add(warp.sub(0.5).mul(12)), 32).toVar()
  // A long trailing release and a firmer downwind leading edge.
  return smoothstep(0, 6, front).mul(smoothstep(8, 10, front).oneMinus())
}

/** Wind at a ground position: the gust 0..1 and the downwind lean it causes, base sway included. */
export function windAt(env: Environment, xz: Node<'vec2'>) {
  const gust = gustAt(env, xz).toVar()
  const sway = sin(env.time.mul(0.9).sub(xz.dot(env.windDirection).mul(0.16))).mul(0.5).add(0.5)
  const lean = env.windStrength.mul(sway.mul(0.14).add(0.16).add(gust.mul(0.85)))
  return { gust, lean }
}
