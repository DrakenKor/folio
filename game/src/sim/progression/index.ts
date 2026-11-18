import { applyCombatOperation, inspectStats, previewAction } from '../combat/build'
import { validateOperation } from '../core/commands'
import { spawnEntity } from '../core/store'
import type { BuildPreview, CharacterData, CharacterLoad, CombatContent, Operation, OperationReason, OperationResult, QueryResult, World } from '../core/types'
import { UnsupportedError } from '../core/unsupported'
import { beginEncounter, healAtRest, returnToShelter } from './encounter'
import { editGraph } from './graph'
import { changeEquipment, moveItem, pickup } from './items'

export { processProgression } from './encounter'
export { graphTopology, type GraphTopology } from './graph'

function apply(world: World, operation: Operation): OperationReason | null {
  const content = world.content.m2
  if (!content) return 'unsupported'
  const player = world.entities.find(e => e.id === world.playerId)
  const character = player?.character
  if (!player || !character) return 'no-player'
  if (operation.type === 'returnToShelter') return returnToShelter(world, player)
  if (player.death) return 'dead'
  if (operation.type === 'pickup') return pickup(world, player, operation.itemId)
  if (operation.type === 'beginEncounter') return beginEncounter(world, player)
  if (world.encounter?.phase !== 'rest') return 'requires-rest'
  let reason: OperationReason | null
  switch (operation.type) {
    case 'allocate': case 'refund': case 'activateShape': {
      const profile = content.graphProfiles.find(p => p.id === character.graph.profileId && p.version === character.graph.version)!
      reason = editGraph(character, profile, operation)
      break
    }
    case 'equip': case 'unequip':
      reason = changeEquipment(world, player, operation)
      break
    case 'stash': case 'discard':
      return moveItem(character, operation)
    default:
      return 'unsupported'
  }
  if (!reason) healAtRest(world, player)
  return reason
}

export function applyProgressionOperation(world: World, operation: Operation): OperationResult {
  const reason = apply(world, operation)
  return reason ? { accepted: false, reason } : { accepted: true, reason: 'ok' }
}

function comparisonWorld(world: World) {
  const comparison = { ...world, entities: [...world.entities] }
  const target = spawnEntity(comparison, { kind: 'preview-target', radius: 0, pos: { x: 0, z: 0 }, maxHealth: Number.MAX_SAFE_INTEGER })
  return { world: comparison, targetId: target.id }
}

/** Compare outgoing damage against an unarmoured target so defensive gear only changes defensive deltas. */
export function previewBuild(world: World, edit: Operation): QueryResult<BuildPreview> {
  validateOperation(edit)
  if (!world.content.m2) return { ok: false, reason: 'unsupported' }
  const player = world.entities.find(e => e.id === world.playerId)
  if (!player?.character) return { ok: false, reason: 'no-player' }
  const next = structuredClone(world)
  const result = edit.type === 'setLoadout' || edit.type === 'setFolds' ?
    applyCombatOperation(next, edit) : applyProgressionOperation(next, edit)
  const beforeStats = inspectStats(world, player.id)
  const afterStats = inspectStats(next, player.id)
  if (!beforeStats.ok) return beforeStats
  if (!afterStats.ok) return afterStats
  const before = beforeStats.value, after = afterStats.value
  const current = player.character
  const changed = next.entities.find(e => e.id === player.id)!.character!
  const originalBuild = comparisonWorld(world), editedBuild = comparisonWorld(next)
  const actions: BuildPreview['actions'] = []
  for (const { id } of world.content.m2.actions) {
    const original = previewAction(originalBuild.world, player.id, id, originalBuild.targetId)
    const edited = previewAction(editedBuild.world, player.id, id, editedBuild.targetId)
    if (!original.ok) return original
    if (!edited.ok) return edited
    actions.push({ skillId: id, before: original.value, after: edited.value })
  }
  return { ok: true, value: { operation: structuredClone(edit), result, before, after, actions,
    delta: { maxHealth: after.maxHealth - before.maxHealth, movementSpeed: after.movementSpeed - before.movementSpeed,
      points: changed.points - current.points, reductions: { weight: after.reductions.weight - before.reductions.weight,
        heat: after.reductions.heat - before.reductions.heat, gale: after.reductions.gale - before.reductions.gale } },
    refundedNodeIds: current.graph.allocations.filter(id => !changed.graph.allocations.includes(id)),
    deactivatedShapeIds: current.graph.activeShapes.filter(id => !changed.graph.activeShapes.includes(id))
  } }
}

/** Project one character without combat transients or platform generation. */
export function exportCharacter(_world: World): CharacterData {
  throw new UnsupportedError('exportCharacter (T2.3)')
}

/** Validate a projection and construct a fresh rested clearing, returning content refunds. */
export function loadCharacter(_data: unknown, _content: CombatContent): CharacterLoad {
  throw new UnsupportedError('loadCharacter (T2.3)')
}
