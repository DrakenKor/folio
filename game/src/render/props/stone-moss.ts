import { type Node } from 'three/webgpu'
import { normalWorld, positionWorld, sin, smoothstep } from 'three/tsl'

/** Broad, soft painted patches settle on upward stone planes. */
export function stoneMoss(bias: Node<'float'>): Node<'float'> {
  const p = positionWorld
  const patch = sin(p.x.mul(1.9).add(sin(p.z.mul(1.2)).mul(1.4)))
    .add(sin(p.z.mul(2.3).sub(p.x.mul(0.7))).mul(0.55)).mul(0.3).add(0.5)
  return smoothstep(0.48, 0.78, patch.add(bias)).mul(smoothstep(0.48, 0.86, normalWorld.y))
}
