// Growth pockets share the ground palette and keep their world positions as the camera moves.
import type { Node } from 'three/webgpu'
import { float, hash, mix, smoothstep, vec2 } from 'three/tsl'
import type { Environment } from '../materials/environment'
import { meadowPatch } from '../terrain/meadow-tones'

/** Metres between clump centres: fixed, so density never depends on the camera. */
export const CLUMP_CELL = 0.5

/** A jittered tuft with independent spread, height and growth variation. */
export function tuftAt(env: Environment, cell: Node<'vec2'>) {
  const seed = cell.x.toInt().add(4096).mul(8192).add(cell.y.toInt().add(4096)).toVar()
  const rand = (salt: number) => hash(seed.add(salt))
  const centre = cell.add(vec2(rand(0x9e37), rand(0x51ed)).mul(0.9).add(0.05)).mul(CLUMP_CELL).toVar()
  const patch = meadowPatch(env, centre, true).toVar()
  const growth = smoothstep(0.45, 0.75, patch).toVar()
  const radius = mix(float(0.18), float(0.32), rand(0x2c1b)).mul(growth.mul(0.3).add(0.75))
  const height = mix(float(0.8), float(1.2), rand(0x7f4a)).mul(mix(float(0.45), float(1.25), growth))
  return { seed, rand, centre, radius, height, growth, patch }
}
