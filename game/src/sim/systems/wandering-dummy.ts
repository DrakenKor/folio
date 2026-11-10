import { fmath } from '../core/fmath'
import { rngFloat } from '../core/rng'
import type { World } from '../core/types'

/** Scenario-only wandering fixtures, each with an independent RNG stream. */
export function wanderDummies(world: World): void {
  for (const entity of world.entities) {
    if (entity.kind !== 'dummy') continue
    if (world.tick === 0 || (world.tick + entity.id) % 120 === 0) {
      entity.facing = rngFloat(world, `dummy:${entity.id}`) * 6.283185307179586
      entity.vel.x = fmath.cos(entity.facing)
      entity.vel.z = fmath.sin(entity.facing)
    }
  }
}
