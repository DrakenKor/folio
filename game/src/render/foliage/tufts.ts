// Dense, overlapping tufts keep their world positions as the camera moves.
import type { Node } from 'three/webgpu'
import { float, hash, mix, smoothstep, texture, vec2 } from 'three/tsl'
import type { Environment } from '../materials/environment'

/** Metres between clump centres: fixed, so density never depends on the camera. */
export const CLUMP_CELL = 0.5

/** Soft growth variation sampled at explicit level zero for blade vertices. */
function clumpGrowth(env: Environment, xz: Node<'vec2'>): Node<'float'> {
  const b = texture(env.noise, xz.div(160)).level(float(0)).r
  const m = texture(env.noise, xz.div(22)).level(float(0)).r
  const f = texture(env.noise, xz.div(14)).level(float(0)).g
  return smoothstep(0.39, 0.61, b.mul(0.2).add(m.mul(0.65)).add(f.mul(0.15)))
}

/** A jittered tuft with independent spread, height and growth variation. */
export function tuftAt(env: Environment, cell: Node<'vec2'>) {
  const seed = cell.x.toInt().add(4096).mul(8192).add(cell.y.toInt().add(4096)).toVar()
  const rand = (salt: number) => hash(seed.add(salt))
  const centre = cell.add(vec2(rand(0x9e37), rand(0x51ed)).mul(0.9).add(0.05)).mul(CLUMP_CELL).toVar()
  const growth = clumpGrowth(env, centre).add(rand(0x5d17).sub(0.5).mul(0.18)).toVar()
  const radius = mix(float(0.22), float(0.34), rand(0x2c1b))
  const height = mix(float(0.85), float(1.15), rand(0x7f4a)).mul(mix(float(0.85), float(1.1), growth))
  return { seed, rand, centre, radius, height }
}
