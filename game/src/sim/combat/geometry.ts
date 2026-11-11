import { fmath } from '../core/fmath'
import type { Entity, Vec2 } from '../core/types'

/** Earliest segment contact with an expanded circle, including initial overlap. */
export function sweepCircle(from: Vec2, to: Vec2, center: Vec2, radius: number): number | null {
  const x = from.x - center.x
  const z = from.z - center.z
  const dx = to.x - from.x
  const dz = to.z - from.z
  const c = x * x + z * z - radius * radius
  if (c <= 0) return 0
  const a = dx * dx + dz * dz
  if (a === 0) return null
  const b = x * dx + z * dz
  const discriminant = b * b - a * c
  if (discriminant < 0) return null
  const fraction = (-b - Math.sqrt(discriminant)) / a
  return fraction >= 0 && fraction <= 1 ? fraction : null
}

/** Circle overlap with a closed sector, including the apex and radial edges. */
export function sectorOverlaps(origin: Vec2, direction: number, range: number, arc: number, target: Entity): boolean {
  const x = target.pos.x - origin.x
  const z = target.pos.z - origin.z
  const square = x * x + z * z
  if (square > (range + target.radius) * (range + target.radius)) return false
  if (square <= target.radius * target.radius || arc >= 2 * Math.PI) return true
  const cosine = fmath.cos(direction)
  const sine = fmath.sin(direction)
  const forward = x * cosine + z * sine
  const side = z * cosine - x * sine
  if (Math.abs(fmath.atan2(side, forward)) <= arc / 2) return true
  const edgeX = fmath.cos(arc / 2)
  const edgeZ = fmath.sin(arc / 2)
  for (const sign of [-1, 1]) {
    const along = Math.max(0, Math.min(range, forward * edgeX + side * edgeZ * sign))
    const dx = forward - edgeX * along
    const dz = side - edgeZ * sign * along
    if (dx * dx + dz * dz <= target.radius * target.radius + 1e-12) return true
  }
  return false
}
