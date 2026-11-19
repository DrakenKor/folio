import { inspectStats as sharedStats, previewAction as sharedAction } from '../combat/build'
import { previewDrawing, type DrawingBuildPreview, type DrawingPreview } from '../combat/m3/preview'
import { actorStats } from '../combat/stats'
import { exportCharacter as projectCharacter, previewBuild as previewLegacyBuild } from '../progression'
import { requiresM3, validateOperation } from './commands'
import { lockedReason, m3Systems, type M3Systems } from './m3-loop'
import { inspectM3Zone } from './m3-state'
import { isM3, sharedBuildView } from './profile'
import { spawnEntity } from './store'
import type {
  ActionPreview, BuildPreview, CharacterData, EntityId, M3CharacterData, M3World, Operation,
  QueryResult, World, ZoneInspection
} from './types'

export function inspectZone(world: World): QueryResult<ZoneInspection> {
  return isM3(world) ? inspectM3Zone(world) : { ok: false, reason: 'unsupported' }
}

export function inspectStats(world: World, actorId: EntityId) {
  return sharedStats(sharedBuildView(world), actorId)
}

export function exportCharacter(world: M3World): M3CharacterData
export function exportCharacter(world: World): CharacterData
export function exportCharacter(world: World): CharacterData {
  const data = projectCharacter(sharedBuildView(world))
  if (isM3(world)) {
    const projection: M3CharacterData = { ...data, contentVersion: world.content.m3.version, progress: structuredClone(world.progress) }
    return projection
  }
  return data
}

export function previewAction(world: M3World, actorId: EntityId, skillId: string, targetId: EntityId): QueryResult<DrawingPreview>
export function previewAction(world: World, actorId: EntityId, skillId: string, targetId: EntityId): QueryResult<ActionPreview>
export function previewAction(world: World, actorId: EntityId, skillId: string, targetId: EntityId): QueryResult<ActionPreview> {
  const view = sharedBuildView(world)
  const base = sharedAction(view, actorId, skillId, targetId)
  if (!base.ok || !isM3(world)) return base
  const card = world.content.m3.actions.find(c => c.id === skillId)
  if (!card) return { ok: false, reason: 'unknown-skill' }
  const actor = world.entities.find(a => a.id === actorId)!
  const target = world.entities.find(a => a.id === targetId)!
  return { ok: true, value: previewDrawing(world, actor, target, card, base.value, lockedReason(world, actor, card)) }
}

export function previewBuild(world: M3World, edit: Operation, systems?: M3Systems): QueryResult<DrawingBuildPreview>
export function previewBuild(world: World, edit: Operation, systems?: M3Systems): QueryResult<BuildPreview>
export function previewBuild(world: World, edit: Operation, systems = m3Systems): QueryResult<BuildPreview> {
  validateOperation(edit)
  if (!isM3(world)) return requiresM3(edit) ? { ok: false, reason: 'unsupported' } : previewLegacyBuild(world, edit)
  const player = world.entities.find(a => a.id === world.playerId)
  if (!player?.character) return { ok: false, reason: 'no-player' }
  const next = structuredClone(world)
  const result = systems.operation(next, structuredClone(edit))
  const current = player.character, changed = next.entities.find(a => a.id === player.id)!.character!
  const before = actorStats(sharedBuildView(world), player)
  const after = actorStats(sharedBuildView(next), next.entities.find(a => a.id === player.id)!)
  const original = { ...world, entities: [...world.entities] }
  const dummy = { kind: 'preview-target', radius: 0, maxHealth: Number.MAX_SAFE_INTEGER, pos: { x: 0, z: 0 } }
  const originalTarget = spawnEntity(original, dummy), changedTarget = spawnEntity(next, dummy)
  const actions: DrawingBuildPreview['actions'] = []
  for (const { id } of world.content.m3.actions) {
    const a = previewAction(original, player.id, id, originalTarget.id), b = previewAction(next, player.id, id, changedTarget.id)
    if (!a.ok) return a
    if (!b.ok) return b
    actions.push({ skillId: id, before: a.value, after: b.value })
  }
  const value: DrawingBuildPreview = { operation: structuredClone(edit), result, before, after, actions, loadout: [...changed.loadout],
    delta: { points: changed.points - current.points, maxHealth: after.maxHealth - before.maxHealth,
      movementSpeed: after.movementSpeed - before.movementSpeed, reductions: {
        weight: after.reductions.weight - before.reductions.weight, heat: after.reductions.heat - before.reductions.heat,
        gale: after.reductions.gale - before.reductions.gale } },
    refundedNodeIds: current.graph.allocations.filter(id => !changed.graph.allocations.includes(id)),
    deactivatedShapeIds: current.graph.activeShapes.filter(id => !changed.graph.activeShapes.includes(id)) }
  return { ok: true, value }
}
