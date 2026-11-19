import { inspectStats as sharedStats, previewAction as sharedAction } from '../combat/build'
import { calculateDamage } from '../combat/damage-model'
import { resolveRecipe } from '../combat/recipe'
import { actorStats } from '../combat/stats'
import { exportCharacter as projectCharacter, previewBuild as previewLegacyBuild } from '../progression'
import { validateOperation } from './commands'
import { lockedReason, m3Systems } from './m3-loop'
import { inspectM3Zone } from './m3-state'
import { isM3, sharedBuildView } from './profile'
import { spawnEntity } from './store'
import type {
  ActionPreview, BuildPreview, CharacterData, EntityId, M3CharacterData, M3ActionPreview, M3BuildPreview, M3World, Operation, PreviewPath,
  QueryResult, ResolvedAction, World, ZoneInspection
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

export function previewAction(world: M3World, actorId: EntityId, skillId: string, targetId: EntityId): QueryResult<M3ActionPreview>
export function previewAction(world: World, actorId: EntityId, skillId: string, targetId: EntityId): QueryResult<ActionPreview>
export function previewAction(world: World, actorId: EntityId, skillId: string, targetId: EntityId): QueryResult<ActionPreview> {
  const view = sharedBuildView(world)
  const base = sharedAction(view, actorId, skillId, targetId)
  if (!base.ok || !isM3(world)) return base
  const card = world.content.m3.actions.find(c => c.id === skillId)
  if (!card) return { ok: false, reason: 'unknown-skill' }
  const actor = world.entities.find(a => a.id === actorId)!
  const target = world.entities.find(a => a.id === targetId)!
  const m = card.mechanic, recipe = base.value.recipe, f = recipe.footprint
  const folds = recipe.folds.map(id => world.content.m3.folds.find(fold => fold.id === id)!)
  const reductions = actorStats(view, target, recipe.tags).reductions
  const amount = (r: ResolvedAction, factor = 1) => calculateDamage({ ...r, modifiers: [...r.modifiers,
    { kind: 'multiplier', id: 'contact', requiredTags: [], types: [], value: factor }] }, reductions, target.health)
  const primaryFactor = folds.reduce((factor, fold) => factor * fold.mechanic.primaryFactor, 1)
  const damage = amount(recipe, primaryFactor)
  let primary = damage.applied
  let condition: M3ActionPreview['condition'] = null
  let payoff: M3ActionPreview['payoff'] = null
  const path: PreviewPath = { role: 'primary', shape: f.kind === 'projectile' ? 'path' : 'sector', reach: f.reach,
    radius: f.radius, arcRadians: f.arcRadians, halfWidth: 0, delayTicks: recipe.timing.windupTicks }
  if ('halfWidth' in m) { path.shape = 'lane'; path.halfWidth = m.halfWidth }
  if (m.kind === 'lay-bed') { path.shape = 'disc'; path.radius = m.radius; path.delayTicks += m.armTicks }
  if (m.kind === 'brace-mark') { path.shape = 'disc'; path.radius = m.answerRadius }
  const paths = [path]
  if (m.kind === 'plinth-blow') {
    const charged = resolveRecipe(view, actor, { ...card, weaponCoefficient: m.chargedCoefficient })
    if (!charged.ok) return charged
    primary = amount(charged.value, primaryFactor).applied
    condition = 'burden'
    payoff = { rootTicks: m.rootTicks }
    path.shape = 'disc'
    path.radius = f.reach
  } else if (m.kind === 'lift-print') {
    condition = 'emberprint'
    payoff = { secondaryDamage: amount({ ...recipe, sourceDamage: { heat: m.impressionHeat, weight: 0, gale: 0 } }).applied }
    paths.push({ ...path, role: 'secondary', shape: 'disc', reach: 0, halfWidth: 0, radius: m.impressionRadius })
  } else if (m.kind === 'gather-line') {
    condition = 'draftbind'
    payoff = { secondaryDamage: amount(recipe, primaryFactor * m.stitchFactor).applied }
    paths.push({ ...path, role: 'secondary', reach: m.stitchReach })
  }
  const value: M3ActionPreview = { ...base.value, damage, paths, condition, payoff, requiredItem: card.familyId,
    lockedReason: lockedReason(world, actor, card), cost: { tension: folds.reduce((sum, fold) => sum + fold.tension, 0),
      seams: m.kind === 'open-hem' ? m.seamCost : 0 },
    conditionalDamage: { clean: [primary], prepared: payoff && 'secondaryDamage' in payoff ? [primary, payoff.secondaryDamage] : [primary] } }
  return { ok: true, value }
}

export function previewBuild(world: M3World, edit: Operation): QueryResult<M3BuildPreview>
export function previewBuild(world: World, edit: Operation): QueryResult<BuildPreview>
export function previewBuild(world: World, edit: Operation): QueryResult<BuildPreview> {
  if (!isM3(world)) return previewLegacyBuild(world, edit)
  validateOperation(edit)
  const player = world.entities.find(a => a.id === world.playerId)
  if (!player?.character) return { ok: false, reason: 'no-player' }
  const next = structuredClone(world)
  const result = m3Systems.operation(next, structuredClone(edit))
  const current = player.character, changed = next.entities.find(a => a.id === player.id)!.character!
  const before = actorStats(sharedBuildView(world), player)
  const after = actorStats(sharedBuildView(next), next.entities.find(a => a.id === player.id)!)
  const original = { ...world, entities: [...world.entities] }
  const dummy = { kind: 'preview-target', radius: 0, maxHealth: Number.MAX_SAFE_INTEGER, pos: { x: 0, z: 0 } }
  const originalTarget = spawnEntity(original, dummy), changedTarget = spawnEntity(next, dummy)
  const actions: M3BuildPreview['actions'] = []
  for (const { id } of world.content.m3.actions) {
    const a = previewAction(original, player.id, id, originalTarget.id), b = previewAction(next, player.id, id, changedTarget.id)
    if (!a.ok) return a
    if (!b.ok) return b
    actions.push({ skillId: id, before: a.value, after: b.value })
  }
  const value: M3BuildPreview = { operation: structuredClone(edit), result, before, after, actions, loadout: [...changed.loadout],
    delta: { points: changed.points - current.points, maxHealth: after.maxHealth - before.maxHealth,
      movementSpeed: after.movementSpeed - before.movementSpeed, reductions: {
        weight: after.reductions.weight - before.reductions.weight, heat: after.reductions.heat - before.reductions.heat,
        gale: after.reductions.gale - before.reductions.gale } },
    refundedNodeIds: current.graph.allocations.filter(id => !changed.graph.allocations.includes(id)),
    deactivatedShapeIds: current.graph.activeShapes.filter(id => !changed.graph.activeShapes.includes(id)) }
  return { ok: true, value }
}
