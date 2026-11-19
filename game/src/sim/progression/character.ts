import { WINDSTEP_CLEARING } from '../../content/m1'
import { m2Content } from '../../content/m2'
import { validateRetainedFolds } from '../combat/build'
import { isM3, sharedBuildView } from '../core/profile'
import { createWorld, spawnEntity } from '../core/store'
import type { CharacterData, CharacterLoad, CharacterState, CombatContent, M2Content, M3CharacterData, MigrateCharacter, World } from '../core/types'
import { UnsupportedError } from '../core/unsupported'
import { validateWorld } from '../core/validation'
import { healAtRest } from './encounter'
import { repairLoadout } from './loadout'
import { migrateDrawings, refundGraphAndItems, refundRemovedContent, validateSourceItems } from './refunds'

export function exportCharacter(world: World): CharacterData {
  const player = world.entities.find(e => e.id === world.playerId)
  if (!player?.character || !world.content.m2 || !world.rng.loot) throw new UnsupportedError('Character projection')
  return { contentVersion: world.content.m2.version, seed: world.seed, character: structuredClone(player.character),
    lootRng: [...world.rng.loot], nextItemId: world.nextItemId, questFlags: {}, settings: {} }
}

function emptyRecord(value: unknown): boolean {
  return value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype &&
    Object.keys(value).length === 0
}

function validateTiers(character: CharacterState, content: M2Content): void {
  for (const item of character.items) {
    for (const roll of item.affixes) {
      const family = content.affixes.find(f => f.id === roll.familyId)!
      const tier = family.tiers.find(t => t.tier === roll.tier)!
      if (tier.unlockRank > character.rank) throw new TypeError('Locked affix tier')
    }
  }
}

function restoredWorld(data: CharacterData, world: World): World {
  world.scenario = world.content.m3 ? 'm3a-clearing' : 'm2-clearing'
  if (isM3(world)) {
    const progress = (data as M3CharacterData).progress
    if (!progress || Object.keys(progress).some(key => !Object.hasOwn(world.progress, key)) ||
      (!world.content.m3.zones?.length && (progress.stage !== 'unstarted' || progress.waypoints.length))) {
      throw new TypeError('Invalid clearing progress')
    }
    world.progress = progress
  }
  world.encounter = { id: world.scenario, phase: 'rest', attempt: 0, rewardedIds: [] }
  world.arena = structuredClone(WINDSTEP_CLEARING.arena)
  world.rng.loot = data.lootRng
  world.nextItemId = data.nextItemId
  const character = data.character
  const player = spawnEntity(world, { ...WINDSTEP_CLEARING.player, kind: 'player', character,
    skills: { primary: character.loadout[0], secondary: character.loadout[1] } })
  validateWorld(world)
  const view = sharedBuildView(world)
  validateTiers(character, view.content.m2!)
  if (isM3(world) && repairLoadout(character, world.content.m3, 'tally').some((id, i) => id !== character.loadout[i])) {
    throw new TypeError('Ineligible saved drawing')
  }
  const retained = validateRetainedFolds(view, player)
  if (!retained.accepted) throw new TypeError('Invalid saved folds: ' + retained.reason)
  healAtRest(view, player)
  return world
}

/** Produce one detached M3 projection and its itemised migration receipt. */
export const migrateCharacter: MigrateCharacter = (source, destination) => {
  const data = structuredClone(source)
  if (data.contentVersion === destination.version) {
    validateSourceItems(data, destination)
    if (!('progress' in data)) throw new TypeError('Missing campaign progress')
    return { data: data as M3CharacterData, refunds: [] }
  }

  const legacy = m2Content()
  if (data.contentVersion !== legacy.m2!.version || 'progress' in data) throw new TypeError('Invalid source content version')
  const refunds: string[] = []
  validateSourceItems(data, legacy.m2!)
  refundGraphAndItems(data.character, legacy.m2!, refunds)
  restoredWorld(data, createWorld(data.seed, undefined, legacy))
  refundGraphAndItems(data.character, destination, refunds)
  migrateDrawings(data.character, destination, refunds)
  return { data: { ...data, contentVersion: destination.version, progress: {
    generatorVersion: 1, stage: 'unstarted', lastSafeMarker: 'hem-rest', repairs: [], waypoints: [], creditedSockets: [], uncollectedDrops: []
  } }, refunds }
}

/** Validate the entire detached projection before exposing a healed player at rest. */
export function loadCharacter(input: unknown, content: CombatContent): CharacterLoad {
  if (!content.m2 && !content.m3) throw new UnsupportedError('Character load')
  const source = input as CharacterData
  if (!source || typeof source.contentVersion !== 'string' || !source.contentVersion ||
    !emptyRecord(source.questFlags) || !emptyRecord(source.settings)) throw new TypeError('Invalid character projection')
  const world = createWorld(source.seed, undefined, content)
  if (isM3(world)) {
    const { data, refunds } = migrateCharacter(source, world.content.m3)
    return { world: restoredWorld(data, world), refunds }
  }
  if ('progress' in source) throw new TypeError('Invalid legacy content version')
  const data = structuredClone(source)
  const refunds = refundRemovedContent(data, content.m2!)
  return { world: restoredWorld(data, world), refunds }
}
