import { WINDSTEP_CLEARING } from '../../content/m1'
import { validateRetainedFolds } from '../combat/build'
import { createWorld, spawnEntity } from '../core/store'
import type { CharacterData, CharacterLoad, CharacterState, CombatContent, M2Content, World } from '../core/types'
import { UnsupportedError } from '../core/unsupported'
import { validateWorld } from '../core/validation'
import { healAtRest } from './encounter'
import { connectedNodes, editGraph } from './graph'
import { refundRemovedContent } from './refunds'

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

/** Enforce the graph and tier rules after the shared snapshot validator has checked identities. */
function validateProgression(character: CharacterState, content: M2Content): void {
  const graph = character.graph
  const profile = content.graphProfiles.find(p => p.id === graph.profileId && p.version === graph.version)!
  if (connectedNodes(graph.allocations, profile.radius).size !== graph.allocations.length + 1) {
    throw new TypeError('Invalid graph connectivity')
  }
  const candidate = { ...character, graph: { ...graph, activeShapes: [] as string[] } }
  for (const shapeId of graph.activeShapes) {
    const reason = editGraph(candidate, profile, { type: 'activateShape', shapeId, active: true })
    if (reason) throw new TypeError('Invalid saved shape: ' + reason)
  }
  for (const item of character.items) {
    for (const roll of item.affixes) {
      const family = content.affixes.find(f => f.id === roll.familyId)!
      const tier = family.tiers.find(t => t.tier === roll.tier)!
      if (tier.unlockRank > character.rank) throw new TypeError('Locked affix tier')
    }
  }
}

/** Validate a detached projection before exposing the fresh, fully healed character. */
export function loadCharacter(input: unknown, content: CombatContent): CharacterLoad {
  if (!content.m2) throw new UnsupportedError('Character load')
  const data = structuredClone(input) as CharacterData
  if (!data || typeof data.contentVersion !== 'string' || !data.contentVersion ||
    !emptyRecord(data.questFlags) || !emptyRecord(data.settings)) throw new TypeError('Invalid character projection')
  const world = createWorld(data.seed, undefined, content)
  const refunds = refundRemovedContent(data, world.content.m2!)
  world.scenario = 'm2-clearing'
  world.encounter = { id: world.scenario, phase: 'rest', attempt: 0, rewardedIds: [] }
  world.arena = structuredClone(WINDSTEP_CLEARING.arena)
  world.rng.loot = data.lootRng
  world.nextItemId = data.nextItemId
  const character = data.character
  const player = spawnEntity(world, { ...WINDSTEP_CLEARING.player, kind: 'player', character,
    skills: { primary: character.loadout[0], secondary: character.loadout[1] } })
  validateWorld(world)
  validateProgression(character, content.m2)
  const retained = validateRetainedFolds(world, player)
  if (!retained.accepted) throw new TypeError('Invalid saved folds: ' + retained.reason)
  healAtRest(world, player)
  return { world, refunds }
}
