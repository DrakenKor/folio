import { fmath } from '../../core/fmath'
import type { Entity, Footprint, Vec2, World } from '../../core/types'
import { sectorOverlaps, sweepCircle } from '../geometry'

export function distance(a: Vec2, b: Vec2) {
  const x = a.x - b.x, z = a.z - b.z
  return Math.sqrt(x * x + z * z)
}
export const heading = (a: Vec2, b: Vec2) => fmath.atan2(b.z - a.z, b.x - a.x)
export const along = (p: Vec2, angle: number, length: number) =>
  ({ x: p.x + fmath.cos(angle) * length, z: p.z + fmath.sin(angle) * length })

/** Cross grid boundaries in ray order. A closed corner blocks diagonal passage. */
function floorFraction(world: World, from: Vec2, to: Vec2): number {
  const grid = world.content.m3?.zones?.find(z => z.id === world.zoneId)
  if (!grid) return 1
  const floor = (x: number, z: number) => x >= 0 && z >= 0 && x < grid.width && z < grid.height && grid.walkable[z * grid.width + x]
  let x = Math.floor(from.x), z = Math.floor(from.z)
  if (!floor(x, z)) return 0
  const dx = to.x - from.x, dz = to.z - from.z
  const sx = Math.sign(dx), sz = Math.sign(dz)
  const strideX = Math.abs(1 / dx), strideZ = Math.abs(1 / dz)
  let tx = dx ? ((sx > 0 ? x + 1 : x) - from.x) / dx : Infinity
  let tz = dz ? ((sz > 0 ? z + 1 : z) - from.z) / dz : Infinity
  while (Math.min(tx, tz) <= 1) {
    const t = Math.min(tx, tz), crossX = tx === t, crossZ = tz === t
    if ((crossX && !floor(x + sx, z)) || (crossZ && !floor(x, z + sz)) ||
      (crossX && crossZ && !floor(x + sx, z + sz))) return Math.max(0, t - 1e-9)
    if (crossX) { x += sx; tx += strideX }
    if (crossZ) { z += sz; tz += strideZ }
  }
  return 1
}

export function clip(world: World, from: Vec2, to: Vec2): Vec2 {
  let t = floorFraction(world, from, to)
  const dx = to.x - from.x, dz = to.z - from.z
  if (world.arena && distance(to, world.arena.center) > world.arena.radius) {
    const x = from.x - world.arena.center.x, z = from.z - world.arena.center.z
    const a = dx * dx + dz * dz, b = x * dx + z * dz
    const c = x * x + z * z - world.arena.radius * world.arena.radius
    if (a) t = Math.min(t, Math.max(0, (Math.sqrt(Math.max(0, b * b - a * c)) - b) / a))
  }
  return t === 1 ? { ...to } : { x: from.x + t * dx, z: from.z + t * dz }
}

export function visible(world: World, a: Vec2, b: Vec2): boolean {
  return (!world.arena || distance(b, world.arena.center) <= world.arena.radius + 1e-9) && floorFraction(world, a, b) === 1
}

export function shape(kind: Footprint['kind'], origin: Vec2, direction = 0, reach = 0, halfWidth = 0, radius = 0, arcRadians = 0): Footprint {
  return { kind, origin: { ...origin }, direction, reach, halfWidth, radius, arcRadians }
}

export function overlap(world: World, f: Footprint, target: Entity): number | null {
  if (!visible(world, f.origin, target.pos)) return null
  if (f.kind === 'sector') return sectorOverlaps(f.origin, f.direction, f.reach, f.arcRadians, target) ? 0 : null
  if (f.kind === 'disc') return distance(f.origin, target.pos) <= f.radius + target.radius ? 0 : null
  const end = clip(world, f.origin, along(f.origin, f.direction, f.reach))
  return sweepCircle(f.origin, end, target.pos, target.radius + f.halfWidth)
}
