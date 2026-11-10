import { SCHEMA_VERSION } from './types'
import type { Entity, EntityId, World } from './types'

/** Create an empty world; named RNG streams are derived lazily from its seed. */
export function createWorld(seed: number, build: string): World {
  if (!Number.isSafeInteger(seed)) throw new RangeError('Seed must be a safe integer')
  return { schema: SCHEMA_VERSION, build, seed, tick: 0, nextId: 1, rng: {}, entities: [], playerId: null }
}

/** Append an entity with a stable id, keeping the table sorted. */
export function spawnEntity(world: World, input: Pick<Entity, 'kind' | 'pos' | 'radius'> & Partial<Pick<Entity, 'vel' | 'facing' | 'action'>>): Entity {
  const entity: Entity = {
    id: world.nextId++, kind: input.kind, pos: { ...input.pos },
    radius: input.radius, vel: { ...(input.vel ?? { x: 0, z: 0 }) },
    facing: input.facing ?? 0, action: input.action ? { ...input.action } : null
  }
  world.entities.push(entity)
  if (entity.kind === 'player') world.playerId = entity.id
  return entity
}

/** Remove an entity without reusing its id. */
export function removeEntity(world: World, id: EntityId): boolean {
  const index = world.entities.findIndex(entity => entity.id === id)
  if (index < 0) return false
  world.entities.splice(index, 1)
  if (world.playerId === id) world.playerId = null
  return true
}
