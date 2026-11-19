import { contentSchema } from '../../content/schema'
import { LEGACY_SIM_BUILD, SCHEMA_VERSION, SIM_BUILD } from './types'
import type { CombatContent, Entity, EntityId, World } from './types'

/** Create an empty world; named RNG streams are derived lazily from its seed. */
export function createWorld(seed: number, build?: string, content?: CombatContent): World {
  if (!Number.isSafeInteger(seed)) throw new RangeError('Seed must be a safe integer')
  const checkedContent = contentSchema.parse(content ?? { skills: [], enemies: [], dodge: {
    timing: { windupTicks: 0, activeTicks: 10, recoveryTicks: 8, moveCancelTicks: 8 },
    distance: 3, cooldownTicks: 30, invulnerableFrom: 2, invulnerableUntil: 8
  } })
  return {
    schema: SCHEMA_VERSION, build: build ?? (checkedContent.m2 ? SIM_BUILD : LEGACY_SIM_BUILD), scenario: 'empty', seed, tick: 0, nextId: 1, rng: {}, entities: [], projectiles: [], playerId: null,
    arena: null, content: checkedContent, nextItemId: 1, encounter: null, groundDrops: [], ailments: [], actionGroups: []
  }
}

/** Append an entity with a stable id, keeping the table sorted. */
export function spawnEntity(world: World, input: Pick<Entity, 'kind' | 'pos' | 'radius'> & Partial<Omit<Entity, 'id' | 'kind' | 'pos' | 'radius'>>): Entity {
  const state = structuredClone(input)
  const entity: Entity = {
    vel: { x: 0, z: 0 }, facing: 0, aim: input.facing ?? 0,
    faction: input.kind === 'player' ? 'player' : 'neutral',
    health: input.maxHealth ?? 1, maxHealth: 1, death: null, action: null,
    skills: { primary: null, secondary: null }, cooldowns: { primary: 0, secondary: 0, dodge: 0 },
    previousButtons: 0, impactPauseTicks: 0, hitFlashTicks: 0, knockback: null,
    gait: { phase: 0, speed: 0 }, ai: null, character: null, skillCooldowns: {},
    ...state, id: world.nextId++
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
  world.projectiles = world.projectiles.filter(projectile => projectile.ownerId !== id)
  for (const entity of world.entities) {
    if (entity.ai?.targetId === id) entity.ai.targetId = null
  }
  if (world.playerId === id) world.playerId = null
  return true
}
