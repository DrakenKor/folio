// Distance bands for foliage: blades and flowers draw in a field that follows
// the camera and thin out with distance from it, over the painted ground grass.
import type { Node } from 'three/webgpu'
import { cameraPosition, cameraWorldMatrix, smoothstep, vec4 } from 'three/tsl'

/** Blades are at full density up to this distance from the camera, in metres. */
export const NEAR_END = 26
/** Blades are gone by this distance; beyond it the ground grass draws alone. */
export const FAR_END = 44

/** Ground point a foliage field centres on: `ahead` metres in front of the camera, so the field covers what it sees. */
export function fieldFocus(ahead: number): Node<'vec2'> {
  const forward = cameraWorldMatrix.mul(vec4(0, 0, -1, 0)).xz
  return cameraPosition.xz.add(forward.div(forward.length().max(1e-3)).mul(ahead))
}

/** 1 in the near band, falling to 0 across the middle band, by distance from the camera. */
export function nearFade(position: Node<'vec3'>): Node<'float'> {
  return smoothstep(NEAR_END, FAR_END, position.distance(cameraPosition)).oneMinus()
}
