// The tuft layout: one clump per world cell, hashed from the cell, so the
// blades and the ground grass under them agree on where every tuft stands and
// how tall it grows. Growth follows soft patches a few metres across, so tufts
// gather into lush groups of mixed sizes with bare gaps between them.
import type { Node } from 'three/webgpu'
import { atan, float, floor, hash, mix, sin, smoothstep, texture, vec2 } from 'three/tsl'
import type { Environment } from '../materials/environment'

/** Metres between clump centres: fixed, so density never depends on the camera. */
export const CLUMP_CELL = 0.5

/**
 * Lushness 0..1 of the clump patch at a ground point, from soft shapes a few
 * metres across. The blades read it at texture level 0 (`exact`); the ground
 * reads it filtered, so far ground never speckles.
 */
export function clumpGrowth(env: Environment, xz: Node<'vec2'>, exact = false): Node<'float'> {
  const broad = texture(env.noise, xz.div(14))
  const fine = texture(env.noise, xz.div(40))
  const b = exact ? broad.level(float(0)).r : broad.r
  const f = exact ? fine.level(float(0)).g : fine.g
  return smoothstep(0.32, 0.68, b.mul(0.55).add(f.mul(0.45)))
}

/** The tuft in a clump cell: its hash, a jittered centre, a radius and a height scale that reaches 0 in the gaps. */
export function tuftAt(env: Environment, cell: Node<'vec2'>) {
  const seed = cell.x.toInt().add(4096).mul(8192).add(cell.y.toInt().add(4096)).toVar()
  const rand = (salt: number) => hash(seed.add(salt))
  const centre = cell.add(vec2(rand(0x9e37), rand(0x51ed)).mul(0.9).add(0.05)).mul(CLUMP_CELL).toVar()
  const growth = clumpGrowth(env, centre, true).add(rand(0x5d17).sub(0.5).mul(0.35)).toVar()
  const radius = mix(float(0.08), float(0.2), rand(0x2c1b)).mul(growth.mul(0.5).add(0.75))
  const height = mix(float(0.7), float(1.25), rand(0x7f4a)).mul(mix(float(0.55), float(1.15), growth))
    .mul(smoothstep(0.12, 0.42, growth))
  return { seed, rand, centre, radius, height }
}

/**
 * The dark patch tufts cast on the ground at their roots, 0..1: a lobed
 * outline per tuft, stronger under taller ones. The four nearest cells hold
 * every tuft that reaches a point.
 */
export function tuftCover(env: Environment, xz: Node<'vec2'>): Node<'float'> {
  const base = floor(xz.div(CLUMP_CELL).sub(0.5)).toVar()
  let cover: Node<'float'> = float(0)
  for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) {
    const tuft = tuftAt(env, base.add(vec2(dx, dz)))
    const delta = xz.sub(tuft.centre)
    const angle = atan(delta.y, delta.x)
    const outline = tuft.radius.mul(sin(angle.mul(5).add(tuft.rand(0x41a7).mul(6.283))).mul(0.16)
      .add(sin(angle.mul(3).add(tuft.rand(0x6c3e).mul(6.283))).mul(0.12)).add(1.05))
    const inside = smoothstep(outline.mul(0.75), outline, delta.length()).oneMinus()
    cover = cover.max(inside.mul(tuft.height.sub(0.35).clamp(0, 1)))
  }
  return cover
}
