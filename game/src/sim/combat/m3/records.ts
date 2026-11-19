import { spawnEffect } from '../../core/m3-state'
import { DAMAGE_TYPES } from '../../core/types'
import type { ActionGroup, Entity, FoldMechanic, Footprint, M3World, OwnedEffect, ResolvedAction } from '../../core/types'
import { add, multiply } from '../decimal'
import { byId } from '../stats'

export const drawing = (world: M3World, id: string) => world.content.m3.actions.find(a => a.id === id)
export const foldsOf = (world: M3World, r: ResolvedAction) => r.folds.map(id => world.content.m3.folds.find(f => f.id === id)!.mechanic)
export function foldOf<K extends FoldMechanic['kind']>(world: M3World, r: ResolvedAction, kind: K) {
  return foldsOf(world, r).find((f): f is Extract<FoldMechanic, { kind: K }> => f.kind === kind)
}
export const price = (world: M3World, r: ResolvedAction) => foldsOf(world, r).reduce((n, f) => multiply(n, f.primaryFactor), 1)

export function chargedRecipe(world: M3World, actor: Entity, recipe: ResolvedAction): ResolvedAction {
  const card = drawing(world, recipe.skillId)!
  if (card.mechanic.kind !== 'plinth-blow') return recipe
  const character = actor.character
  const weapon = character?.items.find(i => i.id === character.equipment.weapon)
  const base = world.content.m3.itemBases.find(b => b.id === weapon?.baseId)
  const sourceDamage = { ...card.baseDamage }
  for (const type of DAMAGE_TYPES) sourceDamage[type] = add(sourceDamage[type],
    multiply(card.mechanic.chargedCoefficient, base?.weaponDamage[type] ?? 0))
  return { ...recipe, sourceDamage }
}
export function scaled(r: ResolvedAction, factor: number): ResolvedAction {
  return factor === 1 ? r : { ...r, modifiers: [...r.modifiers,
    { id: 'contact-price', kind: 'multiplier', types: [], requiredTags: [], value: factor }] }
}

export function record(world: M3World, owner: Entity, recipe: ResolvedAction, kind: OwnedEffect['kind'],
  footprint: Footprint, dueTick: number, expiresTick = dueTick + 1, start = owner.action?.startTick ?? world.tick, childOrdinal = 0) {
  const group = hitGroup(world, owner, start, owner.id + ':' + start)
  return spawnEffect(world, { kind, ownerId: owner.id, recipe, footprint, dueTick, expiresTick, leg: 0,
    groupId: group.id, childOrdinal, endpoint: null,
    startTick: world.tick, acceptedTargetIds: [], excludedTargetIds: [] })
}

export function remember(ids: number[], id: number) {
  ids.push(id)
  ids.sort((a, b) => a - b)
}
export const eyeOf = (world: M3World, owner: Entity) => world.effects.find(e => e.kind === 'eye' && e.ownerId === owner.id)

export function hitGroup(world: Pick<M3World, 'actionGroups'>, owner: Entity, startTick: number, id: string): ActionGroup {
  const existing = world.actionGroups.find(g => g.id === id)
  if (existing) return existing
  const group = { id, actorId: owner.id, actionStartTick: startTick, hitTargetIds: [] }
  world.actionGroups.push(group)
  world.actionGroups.sort(byId)
  return group
}

export function clearFinished(world: M3World) {
  const groups = new Set(world.entities.map(a => a.action?.groupId))
  for (const shot of world.projectiles) { groups.add(shot.groupId); groups.add('shot:' + shot.id) }
  world.effects = world.effects.filter(e => {
    const owner = world.entities.find(a => a.id === e.ownerId)
    if (!owner || owner.death || (e.kind === 'mark' && e.acceptedTargetIds.length)) return false
    const attached = e.kind === 'counter' || (e.kind === 'tile' && !e.leg) ||
      (e.kind === 'echo' && drawing(world, e.recipe.skillId)?.mechanic.kind === 'open-hem')
    if (!attached) return true
    const a = owner.action
    return a && a.id === e.recipe.skillId && e.groupId === owner.id + ':' + a.startTick &&
      (owner.mechanics?.held || a.ageTicks < a.recipe!.timing.windupTicks + a.recipe!.timing.activeTicks)
  })
  for (const effect of world.effects) groups.add(effect.groupId)
  world.actionGroups = world.actionGroups.filter(g => groups.has(g.id))
}
