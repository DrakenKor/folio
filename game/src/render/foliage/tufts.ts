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
  const growth = smoothstep(0.43, 0.58, patch).toVar()
  const radius = mix(float(0.22), float(0.34), rand(0x2c1b))
  const height = mix(float(0.9), float(1.15), rand(0x7f4a)).mul(mix(float(0.98), float(1.28), growth))
  const lean = mix(float(0.6), float(1.25), rand(0x2a79))
  return { seed, rand, centre, radius, height, lean, patch }
}
