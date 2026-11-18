import { DAMAGE_TYPES, TICK_HZ } from '../core/types'
import type { ActionDefinition, DamageValues, Entity, FoldDefinition, OperationReason, OperationResult, ResolvedAction, StatInspection, StatModifier, World } from '../core/types'
import { baseAndFlats } from './damage-model'
import { actorStats, byId, modifierSource, productStat, recoveryTiming, roundAtLeastOne, sumStat } from './stats'

type RecipeResult = { ok: true; value: ResolvedAction } | { ok: false; reason: OperationReason }

function compatible(fold: FoldDefinition, action: ActionDefinition, unfolded: DamageValues): boolean {
  switch (fold.compatibility) {
    case 'finite-reach': return action.reach > 0
    case 'single-projectile': return action.kind === 'projectile'
    case 'melee-sector': return action.kind === 'melee' && action.tags.includes('melee')
    case 'sector': return action.kind === 'melee'
    case 'positive-weight': return unfolded.weight > 0
    case 'positive-heat': return unfolded.heat > 0
    case 'any': return true
  }
}

export function resolveRecipe(world: World, actor: Entity, action: ActionDefinition,
  proposedFolds?: string[], stats: StatInspection = actorStats(world, actor)): RecipeResult {
  const content = world.content.m2!
  const character = actor.character
  const foldIds = proposedFolds ?? (character && Object.hasOwn(character.folds, action.id) ? character.folds[action.id]! : [])
  const sourceDamage = { ...action.baseDamage }
  if (action.tags.includes('weapon') && character) {
    const weapon = character.items.find(item => item.id === character.equipment.weapon)!
    const base = content.itemBases.find(base => base.id === weapon.baseId)!
    for (const type of DAMAGE_TYPES) sourceDamage[type] += action.weaponCoefficient * base.weaponDamage[type]
  }
  const eligible = (mod: StatModifier) => mod.requiredTags.every(tag => action.tags.includes(tag))
  const modifiers = stats.sources.flatMap(source => source.modifiers).filter(eligible).sort(byId)
  const unfolded = baseAndFlats(sourceDamage, modifiers)
  const folds: FoldDefinition[] = []
  for (const id of [...foldIds].sort()) {
    const fold = content.folds.find(fold => fold.id === id)
    if (!fold) return { ok: false, reason: 'unknown-fold' }
    if (folds.some(other => other.handle === fold.handle)) return { ok: false, reason: 'duplicate-handle' }
    if (!compatible(fold, action, unfolded)) return { ok: false, reason: 'incompatible-fold' }
    folds.push(fold)
  }
  if (folds.length > 2 || folds.reduce((sum, fold) => sum + fold.tension, 0) > 3) return { ok: false, reason: 'tension-limit' }
  let reach = action.reach
  let arcRadians = action.kind === 'melee' ? action.arcRadians : 0
  let radius = action.kind === 'projectile' ? action.radius : 0
  let projectileAngles = [0]
  let windup = action.timing.windupTicks
  let recoveryDelta = 0
  for (const fold of folds) {
    reach *= fold.reachFactor
    arcRadians *= fold.arcFactor
    radius *= fold.radiusFactor
    if (fold.projectileAngles.length > 1 || fold.projectileAngles[0] !== 0) projectileAngles = [...fold.projectileAngles]
    windup += fold.windupDelta
    recoveryDelta += fold.recoveryDelta
    modifiers.push(...modifierSource('fold/' + fold.id, fold.name, fold.modifiers).modifiers.filter(eligible))
  }
  modifiers.sort(byId)
  reach *= (1 + sumStat(modifiers, 'reach')) * productStat(modifiers, 'reachMultiplier')
  recoveryDelta += sumStat(modifiers, 'recovery')
  const speed = action.kind === 'projectile' ? action.speed : 0
  const lifetimeTicks = speed ? Math.ceil(TICK_HZ * reach / speed) : 0
  const timing = { ...recoveryTiming(action.timing, recoveryDelta), windupTicks: roundAtLeastOne(windup) }
  if (!DAMAGE_TYPES.every(type => Number.isFinite(sourceDamage[type])) || reach <= 0 || !Number.isFinite(reach) || !Number.isFinite(radius) || !Number.isSafeInteger(lifetimeTicks) ||
    !Number.isSafeInteger(timing.windupTicks + timing.activeTicks + timing.recoveryTicks)) return { ok: false, reason: 'invalid-recipe' }
  return { ok: true, value: { skillId: action.id, tags: [...action.tags], folds: folds.map(fold => fold.id),
    sourceDamage, modifiers, timing, footprint: { kind: action.kind, reach, arcRadians: Math.min(2 * Math.PI, arcRadians),
      radius, speed, lifetimeTicks, projectileAngles } } }
}

/** Check a proposed equipment/build state before progression commits it. */
export function validateRetainedFolds(world: World, actor: Entity): OperationResult {
  const stats = actorStats(world, actor)
  for (const [id, folds] of Object.entries(actor.character?.folds ?? {})) {
    const action = world.content.m2?.actions.find(action => action.id === id)
    if (!action) return { accepted: false, reason: 'unknown-skill' }
    const result = resolveRecipe(world, actor, action, folds, stats)
    if (!result.ok) return { accepted: false, reason: result.reason }
  }
  return { accepted: true, reason: 'ok' }
}
