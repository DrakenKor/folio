import type { ActionPreview, EntityId, Operation, OperationResult, QueryResult, StatInspection, World } from '../core/types'
import { AILMENT_RULES } from './ailments'
import { calculateDamage } from './damage-model'
import { resolveRecipe } from './recipe'
import { actorStats } from './stats'

export { processAilments } from './ailments'
export { validateRetainedFolds } from './recipe'

export function applyCombatOperation(world: World, operation: Operation): OperationResult {
  const content = world.content.m2
  if (!content) return { accepted: false, reason: 'unsupported' }
  const player = world.entities.find(actor => actor.id === world.playerId)
  if (!player?.character) return { accepted: false, reason: 'no-player' }
  if (player.death) return { accepted: false, reason: 'dead' }
  if (world.encounter?.phase !== 'rest') return { accepted: false, reason: 'requires-rest' }
  if (operation.type === 'setLoadout') {
    const ids = operation.slots.filter(id => id !== null)
    if (ids.some(id => !content.actions.some(action => action.id === id))) return { accepted: false, reason: 'unknown-skill' }
    if (new Set(ids).size !== ids.length) return { accepted: false, reason: 'duplicate-skill' }
    player.character.loadout = [...operation.slots]
  } else if (operation.type === 'setFolds') {
    const action = content.actions.find(action => action.id === operation.skillId)
    if (!action) return { accepted: false, reason: 'unknown-skill' }
    const result = resolveRecipe(world, player, action, operation.foldIds)
    if (!result.ok) return { accepted: false, reason: result.reason }
    player.character.folds[action.id] = result.value.folds
  } else return { accepted: false, reason: 'unsupported' }
  return { accepted: true, reason: 'ok' }
}

export function inspectStats(world: World, actorId: EntityId): QueryResult<StatInspection> {
  if (!world.content.m2) return { ok: false, reason: 'unsupported' }
  const actor = world.entities.find(actor => actor.id === actorId)
  return actor ? { ok: true, value: actorStats(world, actor) } : { ok: false, reason: 'no-actor' }
}

export function previewAction(world: World, actorId: EntityId, skillId: string, targetId: EntityId): QueryResult<ActionPreview> {
  if (!world.content.m2) return { ok: false, reason: 'unsupported' }
  const actor = world.entities.find(actor => actor.id === actorId)
  if (!actor) return { ok: false, reason: 'no-actor' }
  const action = world.content.m2.actions.find(action => action.id === skillId)
  if (!action) return { ok: false, reason: 'unknown-skill' }
  const target = world.entities.find(actor => actor.id === targetId)
  if (!target) return { ok: false, reason: 'unknown-target' }
  const stats = actorStats(world, actor)
  const resolved = resolveRecipe(world, actor, action, undefined, stats)
  if (!resolved.ok) return resolved
  const recipe = resolved.value
  const damage = calculateDamage(recipe, actorStats(world, target, recipe.tags).reductions, target.health)
  return { ok: true, value: { recipe, stats, damage, ailments: AILMENT_RULES.map(rule => ({ ...rule })) } }
}
