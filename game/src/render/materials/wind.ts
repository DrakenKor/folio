// One wind field for grass, trees and cloth, so a gust visibly rolls through
// all of them together.
import type { Node } from 'three/webgpu'
import { float, smoothstep, texture } from 'three/tsl'
import type { Environment } from './environment'

/** Gust strength 0..1 at a ground position; big soft fronts drifting downwind. */
export function gustAt(env: Environment, xz: Node<'vec2'>): Node<'float'> {
  const uv = xz.mul(0.022).sub(env.windDirection.mul(env.time.mul(0.055)))
  return smoothstep(0.38, 0.72, texture(env.noise, uv).level(float(0)).r)
}
