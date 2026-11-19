import { validateDamage, validateModifiers, validateTiming } from '../../content/schema'
import { buildAction } from '../combat/recipe'
import { validateGraph } from '../progression/graph'
import { ACTION_TAGS, EQUIPMENT_ROLES } from './types'
import type { CharacterState, ResolvedAction, RolledItem, World } from './types'

function check(condition: unknown, field: string): asserts condition {
  if (!condition) throw new TypeError(`Invalid snapshot ${field}`)
}
const record = (value: unknown) => !!value && typeof value === 'object' && !Array.isArray(value)
const integer = (value: number) => Number.isSafeInteger(value) && value >= 0
const positiveId = (value: number) => integer(value) && value > 0
const text = (value: string) => typeof value === 'string' && value.length > 0
const unique = <T>(values: T[]) => new Set(values).size === values.length
const texts = (values: string[]) => Array.isArray(values) && Array.from(values).every(text) && unique(values)
const ids = (values: number[]) => Array.isArray(values) && Array.from(values).every(positiveId) && unique(values)

export function validateCapturedRecipe(value: ResolvedAction, world: World): void {
  const action = value && buildAction(world, value.skillId)
  const definition = action ?? (value && world.content.m3 && world.content.skills.find(skill => skill.id === value.skillId))
  check(record(value) && definition &&
    Array.isArray(value.tags) && unique(value.tags) && value.tags.every(tag => ACTION_TAGS.includes(tag)) &&
    texts(value.folds) && value.folds.length <= 2 && value.folds.every(id => world.content.m2!.folds.some(fold => fold.id === id)), 'recipe')
  validateDamage(value.sourceDamage)
  validateModifiers(value.modifiers)
  validateTiming(value.timing)
  if (action) check(value.tags.length === action.tags.length && value.tags.every(tag => action.tags.includes(tag)), 'immutable recipe tags')
  const shape = value.footprint
  check(record(shape) && shape.kind === definition.kind &&
    [shape.reach, shape.arcRadians, shape.radius, shape.speed].every(number => Number.isFinite(number) && number >= 0) &&
    shape.reach > 0 && shape.arcRadians <= 2 * Math.PI && integer(shape.lifetimeTicks) &&
    (shape.kind !== 'projectile' || (shape.speed > 0 && shape.lifetimeTicks > 0)) &&
    Array.isArray(shape.projectileAngles) && shape.projectileAngles.length > 0 && shape.projectileAngles.every(Number.isFinite), 'recipe footprint')
}

export function validateItem(value: RolledItem, world: World): void {
  check(record(value) && positiveId(value.id) && value.id < world.nextItemId && EQUIPMENT_ROLES.includes(value.role) &&
    world.content.m2?.itemBases.some(base => base.id === value.baseId && base.role === value.role) &&
    Array.isArray(value.affixes) && value.affixes.length <= 2, 'item')
  const categories = new Set<string>()
  const families = new Set<string>()
  for (const affix of value.affixes) {
    check(record(affix), 'rolled affix')
    const family = world.content.m2!.affixes.find(family => family.id === affix.familyId)
    const tier = family?.tiers.find(tier => tier.tier === affix.tier)
    check(family && tier && family.roles.includes(value.role) && family.category === affix.category &&
      integer(affix.roll) && affix.roll >= tier.min && affix.roll <= tier.max &&
      !categories.has(affix.category) && !families.has(affix.familyId), 'rolled affix')
    categories.add(affix.category)
    families.add(affix.familyId)
  }
}

function character(value: CharacterState, world: World): void {
  check(record(value) && integer(value.rank) && value.rank >= 1 && value.rank <= 21 && integer(value.xp) &&
    (value.rank === 21 ? value.xp === 0 : value.xp < 60 * value.rank) && integer(value.points), 'rank/XP/points')
  const graph = value.graph
  const profile = world.content.m2?.graphProfiles.find(profile => profile.id === graph?.profileId && profile.version === graph.version)
  check(record(graph) && text(graph.profileId) && Number.isSafeInteger(graph.seed) && positiveId(graph.version) &&
    texts(graph.allocations) && texts(graph.activeShapes) && graph.activeShapes.length <= 2 &&
    value.points + graph.allocations.length === value.rank + 3 && profile, 'graph/budget')
  validateGraph(value, profile)
  check(Array.isArray(value.items) && ids(value.inventory) && value.inventory.length <= 30 && ids(value.stash) && value.stash.length <= 30 &&
    record(value.equipment) && EQUIPMENT_ROLES.every(role => value.equipment[role] === null || positiveId(value.equipment[role]!)) &&
    value.equipment.weapon !== null, 'item stores')
  for (const entry of value.items) validateItem(entry, world)
  const owned = value.items.map(item => item.id)
  const placed = [...value.inventory, ...value.stash, ...EQUIPMENT_ROLES.flatMap(role => value.equipment[role] === null ? [] : [value.equipment[role]!])]
  check(unique(owned) && unique(placed) && owned.length === placed.length && placed.every(id => owned.includes(id)) &&
    EQUIPMENT_ROLES.every(role => value.equipment[role] === null || value.items.some(item => item.id === value.equipment[role] && item.role === role)), 'item ownership')
  check(Array.isArray(value.loadout) && value.loadout.length === 6 && value.loadout.every(id => id === null || world.content.m2?.actions.some(action => action.id === id)) &&
    unique(value.loadout.filter(id => id !== null)) && record(value.folds), 'loadout')
  for (const [skillId, folds] of Object.entries(value.folds)) {
    check(world.content.m2?.actions.some(action => action.id === skillId) && texts(folds) && folds.length <= 2 &&
      folds.every(id => world.content.m2!.folds.some(fold => fold.id === id)), 'folds')
    const definitions = folds.map(id => world.content.m2!.folds.find(fold => fold.id === id)!)
    if (world.content.m3) check(definitions.every(f => 'whitelist' in f && Array.isArray(f.whitelist) && f.whitelist.includes(skillId)), 'fold whitelist')
    check(unique(definitions.map(fold => fold.handle)) && definitions.reduce((sum, fold) => sum + fold.tension, 0) <= 3, 'fold budget')
  }
}

/** Validate M2 continuation records without generating builds, rolling loot or resolving stats. */
export function validateBuildState(world: World): void {
  check(positiveId(world.nextItemId) && Array.isArray(world.groundDrops) && world.groundDrops.length <= 60 &&
    Array.isArray(world.ailments) && Array.isArray(world.actionGroups), 'M2 tables')
  const claimed: number[] = []
  for (const actor of world.entities) {
    check(actor.character === null || record(actor.character), 'character')
    if (actor.character !== null) {
      character(actor.character, world)
      claimed.push(...actor.character.items.map(item => item.id))
      check(Object.hasOwn(world.rng, 'loot'), 'loot RNG')
    }
    check(record(actor.skillCooldowns) && Object.entries(actor.skillCooldowns).every(([id, ticks]) =>
      text(id) && integer(ticks) && (world.content.skills.some(skill => skill.id === id) || world.content.m2?.actions.some(action => action.id === id))), 'action cooldowns')
    if (actor.action && actor.action.kind !== 'dodge' && buildAction(world, actor.action.id)) {
      check(actor.action.recipe !== undefined, 'captured action recipe')
    }
    if (actor.action?.recipe !== undefined) {
      validateCapturedRecipe(actor.action.recipe, world)
      check(actor.action.recipe.skillId === actor.action.id, 'action recipe identity')
      if (actor.action.recipe.footprint.projectileAngles.length > 1) check(actor.action.groupId !== undefined, 'fan action group')
    }
  }
  for (const drop of world.groundDrops) {
    check(record(drop) && record(drop.pos) && Number.isFinite(drop.pos.x) && Number.isFinite(drop.pos.z), 'drop')
    validateItem(drop.item, world)
    claimed.push(drop.item.id)
  }
  check(unique(claimed), 'global item ids')
  const encounter = world.encounter
  check(encounter === null || (record(encounter) && text(encounter.id) && ['rest', 'active', 'defeat'].includes(encounter.phase) &&
    integer(encounter.attempt) && ids(encounter.rewardedIds) && encounter.rewardedIds.every(id => id < world.nextId)), 'encounter')
  let previous = ''
  for (const group of world.actionGroups) {
    check(record(group) && text(group.id) && group.id > previous && world.entities.some(actor => actor.id === group.actorId) &&
      integer(group.actionStartTick) && group.actionStartTick <= world.tick && ids(group.hitTargetIds) &&
      group.hitTargetIds.every((id, index) => id < world.nextId && id !== group.actorId && (index === 0 || id > group.hitTargetIds[index - 1]!)), 'action group')
    previous = group.id
  }
  for (const actor of world.entities) if (actor.action?.groupId !== undefined) {
    check(world.actionGroups.some(group => group.id === actor.action!.groupId && group.actorId === actor.id && group.actionStartTick === actor.action!.startTick), 'action group reference')
  }
  for (const projectile of world.projectiles) {
    if (world.content.m2?.actions.some(action => action.id === projectile.skillId)) check(projectile.recipe !== undefined, 'captured projectile recipe')
    if (projectile.recipe !== undefined) {
      validateCapturedRecipe(projectile.recipe, world)
      check(projectile.recipe.skillId === projectile.skillId, 'projectile recipe identity')
      if (projectile.recipe.footprint.projectileAngles.length > 1) check(projectile.groupId !== undefined, 'fan projectile group')
    }
    if (projectile.groupId !== undefined) check(world.actionGroups.some(group => group.id === projectile.groupId &&
      group.actorId === projectile.ownerId && group.actionStartTick === projectile.actionStartTick), 'projectile group reference')
  }
  previous = ''
  for (const ailment of world.ailments) {
    const key = `${String(ailment?.targetId).padStart(16, '0')}:${ailment?.id}`
    check(record(ailment) && ['burden', 'emberprint', 'draftbind'].includes(ailment.id) && key > previous &&
      world.entities.some(actor => actor.id === ailment.targetId && actor.death === null) &&
      positiveId(ailment.sourceId) && ailment.sourceId < world.nextId && integer(ailment.appliedTick) && ailment.appliedTick <= world.tick &&
      integer(ailment.expiresTick) && ailment.expiresTick > world.tick &&
      (ailment.id === 'emberprint' ? integer(ailment.nextPulseTick) && ailment.nextPulseTick > world.tick : ailment.nextPulseTick === null), 'ailment')
    previous = key
  }
}
