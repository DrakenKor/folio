import { fmath } from '../core/fmath'
import { rngFloat } from '../core/rng'
import type { EntityId, World } from '../core/types'
import type { ActorTick } from './actors'

/** Scenario-only wandering fixtures, each with an independent RNG stream. */
export function wanderDummies(world: World, states: Map<EntityId, ActorTick>): void {
  for (const entity of world.entities) {
    const state = states.get(entity.id)!
    if (entity.kind !== 'dummy' || entity.id === world.playerId || entity.ai || entity.death ||
      entity.action || entity.knockback || state.paused) continue
    if (world.tick === 1 || (world.tick - 1 + entity.id) % 120 === 0) {
      entity.facing = rngFloat(world, `dummy:${entity.id}`) * 6.283185307179586
      entity.aim = entity.facing
      entity.vel.x = fmath.cos(entity.facing)
      entity.vel.z = fmath.sin(entity.facing)
    }
    state.command = { move: { ...entity.vel }, aim: null, buttons: 0 }
  }
}
