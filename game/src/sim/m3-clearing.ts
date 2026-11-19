import { WINDSTEP_CLEARING } from '../content/m1'
import { m3ClearingContent } from '../content/m3'
import { pressurePack } from '../content/m3/pressure'
import { actorStats } from './combat/stats'
import { fmath } from './core/fmath'
import { sharedBuildView } from './core/profile'
import { rngFloat } from './core/rng'
import { createWorld, spawnEntity } from './core/store'
import type { CharacterState, Loadout, M3World, RolledItem } from './core/types'

export function buildM3Clearing(seed: number): M3World {
  const world = createWorld(seed, undefined, m3ClearingContent)
  const content = world.content.m3
  const profile = content.graphProfiles[0]!
  const items: RolledItem[] = content.itemBases.filter(base => base.starter)
    .map(base => ({ id: world.nextItemId++, baseId: base.id, role: base.role, affixes: [] }))
  const equipment = Object.fromEntries(items.map(item => [item.role, item.id])) as CharacterState['equipment']
  const loadout: Loadout = ['span-cut', 'open-hem', 'fold-dart', 'rill-fan', null, null]

  world.scenario = 'm3a-clearing'
  world.arena = structuredClone(WINDSTEP_CLEARING.arena)
  world.encounter = { id: world.scenario, phase: 'rest', attempt: 0, rewardedIds: [] }
  // Initialise the saved loot stream with the same first draw as the M2 clearing.
  rngFloat(world, 'loot')
  const player = spawnEntity(world, {
    kind: 'player', ...WINDSTEP_CLEARING.player, skills: { primary: loadout[0], secondary: loadout[1] },
    character: {
      rank: 1, xp: 0, points: 4, graph: { profileId: profile.id, seed, version: profile.version, allocations: [], activeShapes: [] },
      items, equipment, loadout, inventory: [], stash: [], folds: {}
    }
  })
  player.maxHealth = actorStats(sharedBuildView(world), player).maxHealth
  player.health = player.maxHealth
  return world
}

/** Spawn the clearing pack from the marker as part of an accepted beginEncounter. */
export function spawnPressurePack(world: M3World) {
  const marker = WINDSTEP_CLEARING.player.pos
  return pressurePack(world.seed).map(({ enemyId, offset }) => {
    const enemy = world.content.enemies.find(definition => definition.id === enemyId)!
    return spawnEntity(world, {
      kind: enemy.id, faction: 'enemy', pos: { x: marker.x + offset.x, z: marker.z + offset.z },
      radius: enemy.radius, maxHealth: enemy.maxHealth, facing: fmath.atan2(-offset.z, -offset.x),
      skills: { primary: enemy.skillId, secondary: null },
      ai: { enemyId, phase: 'idle', ageTicks: 0, targetId: null }
    })
  })
}
