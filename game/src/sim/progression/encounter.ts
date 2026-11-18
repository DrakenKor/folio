import { WINDSTEP_CLEARING } from '../../content/m1'
import { spawnBalanceWave } from '../build-scenarios'
import { actorStats } from '../combat/stats'
import { Button } from '../core/types'
import type { Entity, OperationReason, QueryResult, SimEvent, World } from '../core/types'
import { spawnCreaseback } from '../scenarios'
import { pickupNearest } from './items'
import { rewardKill } from './loot'

export function healAtRest(world: World, player: Entity) {
  player.maxHealth = actorStats(world, player).maxHealth
  player.health = player.maxHealth
}

function enterRest(world: World, player: Entity) {
  world.encounter!.phase = 'rest'
  world.entities = [player]
  world.projectiles = []
  world.ailments = []
  world.actionGroups = []
  player.death = null
  player.action = null
  player.knockback = null
  player.impactPauseTicks = 0
  player.hitFlashTicks = 0
  player.previousButtons = 0
  player.skillCooldowns = {}
  player.cooldowns = { primary: 0, secondary: 0, dodge: 0 }
  player.vel = { x: 0, z: 0 }
  player.gait.speed = 0
  healAtRest(world, player)
}

export function beginEncounter(world: World, player: Entity): OperationReason | null {
  const encounter = world.encounter
  if (!encounter) return 'encounter-inactive'
  if (encounter.phase !== 'rest') return 'encounter-active'
  encounter.phase = 'active'
  encounter.attempt++
  encounter.rewardedIds = []
  world.groundDrops = []
  if (world.scenario === 'm2-clearing') {
    player.pos = { ...WINDSTEP_CLEARING.player.pos }
    for (const pos of WINDSTEP_CLEARING.enemies) spawnCreaseback(world, pos).faction = 'enemy'
  }
  return null
}

export function returnToShelter(world: World, player: Entity): OperationReason | null {
  if (world.scenario === 'm2-balance') return 'encounter-inactive'
  if (world.encounter?.phase !== 'defeat') return world.encounter?.phase === 'active' ? 'encounter-active' : 'encounter-inactive'
  player.pos = { ...WINDSTEP_CLEARING.player.pos }
  enterRest(world, player)
  return null
}

/** Resolve every credited death before deciding the encounter outcome. */
export function processProgression(world: World, events: SimEvent[]): QueryResult<null> {
  const encounter = world.encounter
  if (!encounter || !world.content.m2) return { ok: false, reason: 'unsupported' }
  const player = world.entities.find(e => e.id === world.playerId)
  if (!player?.character) return { ok: false, reason: 'no-player' }
  for (const event of events) {
    if (event.type !== 'death' || event.actorId !== player.id || encounter.rewardedIds.includes(event.targetId)) continue
    const target = world.entities.find(e => e.id === event.targetId)
    if (target?.ai?.enemyId !== 'creaseback') continue
    encounter.rewardedIds.push(target.id)
    rewardKill(world, player.character, event.position)
  }
  if (player.death) encounter.phase = 'defeat'
  else {
    if (player.previousButtons & Button.Interact) pickupNearest(world, player)
    if (encounter.phase === 'active' && world.scenario === 'm2-clearing' &&
      !world.entities.some(e => e.ai?.enemyId === 'creaseback' && !e.death)) enterRest(world, player)
  }
  if (world.scenario === 'm2-balance') events.push(...spawnBalanceWave(world))
  return { ok: true, value: null }
}
