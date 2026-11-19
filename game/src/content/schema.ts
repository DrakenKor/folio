import { ACTION_TAGS, DAMAGE_TYPES, EQUIPMENT_ROLES, EFFECT_KINDS, M3_VERSION, TRAITS, WEAPON_FAMILIES } from '../sim/core/types'
import type {
  ActionDefinition, ActionMechanic, ActionTiming, AffixDefinition, CombatContent, DamageValues, FoldDefinition,
  Footprint, GraphProfile, ItemBase, LootTable, M2Content, M3ActionDefinition, M3Content, M3FoldDefinition,
  EffectCard, M3ItemBase, ValidatedContent, SkillDefinition, StatModifier, Vec2, ZoneDefinition
} from '../sim/core/types'

export type {
  ActionDefinition, AffixDefinition, EffectCard, FoldDefinition, GraphProfile, ItemBase, LootTable,
  M2Content, M3ActionDefinition, M3Content, M3FoldDefinition, M3ItemBase, WarningCard, ZoneDefinition
} from '../sim/core/types'

export function contentCheck(condition: unknown, field: string): asserts condition {
  if (!condition) throw new TypeError(`Invalid content ${field}`)
}
const record = (value: unknown) => !!value && typeof value === 'object' && !Array.isArray(value)
const finite = (value: number) => Number.isFinite(value)
const nonnegative = (value: number) => finite(value) && value >= 0
const positive = (value: number) => finite(value) && value > 0
const integer = (value: number) => Number.isSafeInteger(value) && value >= 0
const id = (value: string) => typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
const text = (value: string) => typeof value === 'string' && value.length > 0
const unique = <T>(values: T[]) => new Set(values).size === values.length
const enumList = <T>(values: T[], allowed: readonly T[]) => Array.isArray(values) && unique(values) && Array.from(values).every(value => allowed.includes(value))

export function validateTiming(value: ActionTiming): void {
  contentCheck(record(value) && integer(value.windupTicks) && integer(value.activeTicks) && value.activeTicks > 0 &&
    integer(value.recoveryTicks) && integer(value.moveCancelTicks) && value.moveCancelTicks <= value.recoveryTicks &&
    Number.isSafeInteger(value.windupTicks + value.activeTicks + value.recoveryTicks), 'timing')
}

export function validateDamage(value: DamageValues): void {
  contentCheck(record(value) && DAMAGE_TYPES.every(type => nonnegative(value[type])), 'damage values')
}

export function validateModifiers(values: StatModifier[]): void {
  contentCheck(Array.isArray(values) && unique(values.map(value => value?.id)), 'modifiers')
  for (const value of values) {
    contentCheck(record(value) && text(value.id) && enumList(value.requiredTags, ACTION_TAGS) &&
      enumList(value.types, DAMAGE_TYPES) && finite(value.value), 'modifier')
    switch (value.kind) {
      case 'flat':
      case 'reduction':
        contentCheck(DAMAGE_TYPES.includes(value.damageType) && (value.kind !== 'flat' || nonnegative(value.value)), 'typed modifier')
        break
      case 'conversion':
        contentCheck(((value.from === 'weight' && (value.to === 'heat' || value.to === 'gale')) ||
          (value.from === 'heat' && value.to === 'gale')) && value.value >= 0 && value.value <= 1, 'conversion')
        break
      case 'multiplier':
      case 'healthMultiplier':
      case 'reachMultiplier':
        contentCheck(nonnegative(value.value), 'factor')
        break
      case 'boost': case 'health': case 'movement': case 'reach': case 'recovery': case 'dodgeRecovery': case 'dodgeCooldown':
        break
      default: contentCheck(false, 'modifier kind')
    }
  }
}

function validateSkill(value: SkillDefinition): void {
  contentCheck(record(value) && id(value.id) && value.id !== 'dodge' && integer(value.cooldownTicks) && nonnegative(value.damage) &&
    record(value.knockback) && nonnegative(value.knockback.speed) && integer(value.knockback.ticks) &&
    integer(value.impactPauseTicks) && integer(value.hitFlashTicks), 'skill')
  validateTiming(value.timing)
  contentCheck(value.kind === 'melee' ? positive(value.range) && positive(value.arcRadians) && value.arcRadians <= 2 * Math.PI :
    value.kind === 'projectile' && positive(value.speed) && nonnegative(value.radius) && integer(value.lifetimeTicks) && value.lifetimeTicks > 0, 'skill geometry')
}

function validateAction(value: ActionDefinition): void {
  validateSkill(value)
  contentCheck(text(value.name) && enumList(value.tags, ACTION_TAGS) && value.tags.length > 0 &&
    nonnegative(value.weaponCoefficient) && positive(value.reach), 'action')
  contentCheck(value.tags.includes('weapon') !== value.tags.includes('cast') &&
    (value.kind === 'projectile' ? value.tags.includes('projectile') : value.tags.includes('area')), 'action delivery')
  validateDamage(value.baseDamage)
}

function validateFold(value: FoldDefinition): void {
  contentCheck(record(value) && id(value.id) && text(value.name) && ['reach', 'spread', 'material'].includes(value.handle) &&
    [1, 2].includes(value.tension) && ['finite-reach', 'single-projectile', 'melee-sector', 'sector', 'positive-weight', 'positive-heat', 'any'].includes(value.compatibility) &&
    positive(value.reachFactor) && positive(value.arcFactor) && positive(value.radiusFactor) &&
    Number.isSafeInteger(value.windupDelta) && Number.isSafeInteger(value.recoveryDelta) &&
    Array.isArray(value.projectileAngles) && value.projectileAngles.length > 0 && unique(value.projectileAngles) &&
    value.projectileAngles.every(angle => finite(angle) && angle >= -180 && angle <= 180), 'fold')
  validateModifiers(value.modifiers)
}

function validateGraph(value: GraphProfile): void {
  contentCheck(record(value) && id(value.id) && integer(value.version) && value.version > 0 && integer(value.radius) && value.radius > 0 &&
    Array.isArray(value.families) && value.families.length === 6 && Array.isArray(value.bargains) && value.bargains.length === 6, 'graph profile')
  definitions(value.families, family => {
    contentCheck(text(family.name), 'graph family')
    validateModifiers(family.modifiers)
  })
  contentCheck(unique(value.bargains.map(bargain => bargain?.orientation)), 'graph orientations')
  for (const bargain of value.bargains) {
    contentCheck(record(bargain) && integer(bargain.orientation) && bargain.orientation < 6, 'shape bargain')
    validateModifiers(bargain.rhombus)
    validateModifiers(bargain.hexagon)
  }
}

function validateBase(value: ItemBase): void {
  contentCheck(record(value) && id(value.id) && text(value.name) && EQUIPMENT_ROLES.includes(value.role) && typeof value.starter === 'boolean', 'item base')
  validateDamage(value.weaponDamage)
  contentCheck(value.role === 'weapon' || DAMAGE_TYPES.every(type => value.weaponDamage[type] === 0), 'weapon base role')
  validateModifiers(value.modifiers)
  contentCheck(value.modifiers.every(modifier => modifier.kind !== 'conversion' && modifier.kind !== 'multiplier'), 'item base pool')
}

function validateAffix(value: AffixDefinition): void {
  contentCheck(record(value) && id(value.id) && text(value.name) && ['offensive', 'utility'].includes(value.category) &&
    enumList(value.roles, EQUIPMENT_ROLES) && value.roles.length > 0 && finite(value.valuePerPoint) && value.valuePerPoint !== 0 &&
    Array.isArray(value.tiers) && value.tiers.length === 3, 'affix')
  validateModifiers([value.modifier])
  contentCheck(!['conversion', 'multiplier', 'healthMultiplier', 'reachMultiplier'].includes(value.modifier.kind) &&
    (value.category !== 'offensive' || value.roles.every(role => role !== 'offhand' && role !== 'boots')), 'affix pool')
  const pools = {
    weapon: { offensive: ['flat', 'boost'], utility: ['health', 'recovery'] },
    offhand: { offensive: [], utility: ['health', 'reduction', 'dodgeRecovery'] },
    coat: { offensive: ['boost'], utility: ['health', 'reduction'] },
    boots: { offensive: [], utility: ['health', 'movement', 'dodgeCooldown'] },
    'survey-tally': { offensive: ['flat', 'boost'], utility: ['reach'] }
  }
  contentCheck(value.roles.every(role => (pools[role][value.category] as string[]).includes(value.modifier.kind)) &&
    (value.valuePerPoint > 0 || ['recovery', 'dodgeRecovery', 'dodgeCooldown'].includes(value.modifier.kind)), 'affix role/scale')
  for (let index = 0; index < value.tiers.length; index++) {
    const tier = value.tiers[index]!
    contentCheck(record(tier) && tier.tier === index + 1 && integer(tier.min) && integer(tier.max) && tier.max >= tier.min &&
      integer(tier.unlockRank) && tier.unlockRank >= 1 && tier.unlockRank <= 21, 'affix tier')
  }
}

function validateLoot(value: LootTable): void {
  contentCheck(record(value) && id(value.id) && nonnegative(value.dropChance) && value.dropChance <= 1 &&
    Array.isArray(value.roles) && value.roles.length > 0 && unique(value.roles.map(entry => entry?.role)) &&
    value.roles.every(entry => record(entry) && EQUIPMENT_ROLES.includes(entry.role) && positive(entry.weight)) &&
    Array.isArray(value.rarities) && value.rarities.length > 0 && value.rarities.every(entry => record(entry) &&
      enumList(entry.categories, ['offensive', 'utility']) && positive(entry.weight)) &&
    unique(value.rarities.map(entry => [...entry.categories].sort().join(','))) &&
    Array.isArray(value.tiers) && value.tiers.length > 0 && unique(value.tiers.map(entry => entry?.tier)) &&
    value.tiers.every(entry => record(entry) && [1, 2, 3].includes(entry.tier) && positive(entry.weight) &&
      integer(entry.unlockRank) && entry.unlockRank >= 1 && entry.unlockRank <= 21), 'loot table')
}

function definitions<T extends { id: string }>(values: T[], validate: (value: T) => void): void {
  contentCheck(Array.isArray(values) && unique(values.map(value => value?.id)), 'definition ids')
  for (const value of values) {
    contentCheck(record(value) && id(value.id), 'definition id')
    validate(value)
  }
}

/** Check references and all authored schemas before any actor is constructed. */
export function validateContent(value: CombatContent): void {
  contentCheck(record(value), 'combat')
  contentCheck(!(value.m2 !== undefined && value.m3 !== undefined), 'ambiguous build profile')
  if (value.m2 !== undefined) {
    contentCheck(value.m2?.version !== M3_VERSION, 'M2 profile version')
    validateM2(value.m2)
  }
  if (value.m3 !== undefined) validateM3(value.m3 as M3Content)
  const profile = value.m3 ?? value.m2
  definitions(value.skills, validateSkill)
  definitions(value.enemies, enemy => {
    contentCheck(positive(enemy.maxHealth) && nonnegative(enemy.radius) && nonnegative(enemy.moveSpeed) &&
      nonnegative(enemy.acquireRange) && nonnegative(enemy.attackRange) && enemy.attackRange <= enemy.acquireRange &&
      integer(enemy.deathTicks) && enemy.deathTicks > 0 && [...value.skills, ...(profile?.actions ?? [])].some(skill => skill.id === enemy.skillId), 'enemy')
  })
  if (value.m3) {
    contentCheck(value.skills.every(skill => !profile!.actions.some(action => action.id === skill.id)), 'skill/action collision')
    value.skills.forEach(validateBoundedSkill)
    for (const enemy of value.enemies) {
      contentCheck([enemy.radius, enemy.moveSpeed, enemy.acquireRange, enemy.attackRange].every(length) &&
        ticks(enemy.deathTicks) && (enemy.boss === undefined || typeof enemy.boss === 'boolean') &&
        (enemy.traits === undefined || (enumList(enemy.traits, TRAITS) && (!enemy.boss || !enemy.traits.length))), 'enemy traits/geometry')
      if (enemy.warnings !== undefined) {
        contentCheck(Array.isArray(enemy.warnings) && enemy.warnings.length <= 8, 'warning count')
        for (const warning of enemy.warnings) {
          contentCheck(record(warning) && ticks(warning.delayTicks) && ticks(warning.recoveryTicks), 'warning timing')
          validateFootprint(warning.footprint)
          contentCheck(warning.effectId === undefined || (value.m3 as M3Content).effects?.some(e => e.id === warning.effectId), 'warning effect')
        }
      }
    }
    for (const zone of value.m3.zones ?? []) contentCheck(zone.sockets.every(s => value.enemies.some(e => e.id === s.enemyId)), 'socket enemy')
  }
  contentCheck(value.skills.every((skill, index) => index === 0 || skill.id > value.skills[index - 1]!.id) &&
    value.enemies.every((enemy, index) => index === 0 || enemy.id > value.enemies[index - 1]!.id), 'definition order')
  const dodge = value.dodge
  contentCheck(record(dodge), 'dodge')
  validateTiming(dodge.timing)
  contentCheck(dodge.timing.windupTicks === 0 && positive(dodge.distance) && integer(dodge.cooldownTicks) && dodge.cooldownTicks > 0 &&
    integer(dodge.invulnerableFrom) && integer(dodge.invulnerableUntil) && dodge.invulnerableFrom < dodge.invulnerableUntil &&
    dodge.invulnerableUntil <= dodge.timing.activeTicks, 'dodge')
}

function validateM2(value: M2Content): void {
  contentCheck(record(value) && text(value.version), 'version')
  definitions(value.actions, validateAction)
  definitions(value.folds, validateFold)
  definitions(value.graphProfiles, validateGraph)
  definitions(value.itemBases, validateBase)
  definitions(value.affixes, validateAffix)
  definitions(value.lootTables, validateLoot)
  contentCheck(EQUIPMENT_ROLES.every(role => value.itemBases.filter(base => base.role === role && base.starter).length === 1), 'starter bases')
  contentCheck(value.lootTables.every(table => table.roles.every(entry => value.itemBases.some(base => base.role === entry.role))), 'loot roles')
}

// A 32 m square fits within a 64 m sweep. Timed card parameters use world or actor ticks.
const length = (n: number) => nonnegative(n) && n <= 64
const distance = (n: number) => length(n) && n > 0
const ticks = (n: number) => integer(n) && n > 0 && n <= 9000
const factor = (n: number) => positive(n) && n <= 1

export function validateFootprint(f: Footprint): void {
  contentCheck(record(f) && record(f.origin) && finite(f.origin.x) && finite(f.origin.z) && finite(f.direction) &&
    [f.radius, f.reach, f.halfWidth].every(length) && nonnegative(f.arcRadians) && f.arcRadians <= 2 * Math.PI &&
    (f.kind === 'disc' ? f.radius > 0 : f.kind === 'lane' ? f.reach > 0 && f.halfWidth > 0 :
      f.kind === 'sector' && f.reach > 0 && f.arcRadians > 0), 'footprint')
}

function validateBoundedSkill(skill: SkillDefinition): void {
  contentCheck(ticks(skill.timing.windupTicks + skill.timing.activeTicks + skill.timing.recoveryTicks) &&
    length(skill.knockback.speed) && [skill.cooldownTicks, skill.knockback.ticks, skill.impactPauseTicks, skill.hitFlashTicks].every(n => n <= 9000) &&
    (skill.kind === 'melee' ? distance(skill.range) : distance(skill.speed) && length(skill.radius) && ticks(skill.lifetimeTicks)), 'bounded skill')
}

function validateM3Action(action: M3ActionDefinition): void {
  validateAction(action)
  validateBoundedSkill(action)
  const m = action.mechanic
  contentCheck(record(m) && distance(action.reach), 'action mechanic')
  const family = {
    'span-cut': 'hemblade', 'open-hem': 'hemblade', 'plinth-blow': 'plumbshoe', 'brace-mark': 'plumbshoe',
    'cast-loop': 'verge-reel', 'gather-line': 'verge-reel', 'lay-bed': 'hearth-frame', 'lift-print': 'hearth-frame',
    'fold-dart': 'survey-tally', 'rill-fan': 'survey-tally'
  } as const
  contentCheck(Object.hasOwn(family, m.kind) && family[m.kind] === action.familyId &&
    action.tags.includes(action.familyId === 'survey-tally' ? 'cast' : 'weapon') &&
    (action.kind === 'projectile') === ['cast-loop', 'gather-line', 'fold-dart'].includes(m.kind), 'action family/delivery')
  let valid: boolean
  switch (m.kind) {
    case 'span-cut': valid = ticks(m.refreshTicks) && ticks(m.maxSeams) && m.maxSeams <= 2; break
    case 'open-hem': valid = ticks(m.seamCost) && m.seamCost <= 2 && ticks(m.stepTicks) && distance(m.halfWidth); break
    case 'plinth-blow': valid = ticks(m.chargedAt) && ticks(m.autoReleaseAt) && m.chargedAt <= m.autoReleaseAt &&
      positive(m.chargedCoefficient) && ticks(m.rootTicks); break
    case 'brace-mark': valid = factor(m.incomingFactor) && distance(m.answerReach) && distance(m.answerRadius); break
    case 'cast-loop': valid = ticks(m.eyeLifetime); break
    case 'gather-line': valid = factor(m.stitchFactor) && distance(m.stitchReach); break
    case 'lay-bed': valid = distance(m.radius) && ticks(m.armTicks) && ticks(m.expiryTicks) && m.armTicks < m.expiryTicks; break
    case 'lift-print': valid = distance(m.halfWidth) && nonnegative(m.impressionHeat) && distance(m.impressionRadius); break
    case 'fold-dart': valid = true; break
    case 'rill-fan': valid = distance(m.halfWidth) && ticks(m.pulseTicks) && ticks(m.maxPulses) && m.maxPulses <= 4 &&
      positive(m.maxTurnDegrees) && m.maxTurnDegrees <= 180; break
    default: valid = false
  }
  contentCheck(valid, 'action parameters')
}

function validateM3Fold(fold: M3FoldDefinition): void {
  validateFold(fold)
  const m = fold.mechanic
  contentCheck(record(m) && factor(m.primaryFactor) && Array.isArray(fold.whitelist) && fold.whitelist.length &&
    unique(fold.whitelist) && Array.from(fold.whitelist).every(id), 'fold mechanic/whitelist')
  let valid: boolean
  switch (m.kind) {
    case 'splay': valid = fold.handle === 'spread' && Array.isArray(m.angles) && m.angles.length === 3 && unique(m.angles) &&
      m.angles.every(a => finite(a) && Math.abs(a) <= 180); break
    case 'through': valid = fold.handle === 'reach' && m.maxContacts === 2; break
    case 'after': valid = fold.handle === 'material' && ticks(m.delayTicks) && factor(m.echoFactor); break
    case 'hinge': valid = fold.handle === 'reach' && factor(m.retraceFraction) && factor(m.returnFactor); break
    case 'rim': valid = fold.handle === 'spread' && [m.offset, m.tileRadius, m.laneHalfWidth].every(distance); break
    case 'catch': valid = fold.handle === 'material' && ticks(m.delayTicks) && ticks(m.expiryTicks) && distance(m.radius) && factor(m.entrantFactor); break
    default: valid = false
  }
  contentCheck(valid, 'fold handle/parameters')
}

function validateM3Base(base: M3ItemBase): void {
  validateBase(base)
  contentCheck(base.role === 'weapon' ? WEAPON_FAMILIES.includes(base.familyId) : !('familyId' in base), 'item family')
}

function validateZone(zone: ZoneDefinition): void {
  contentCheck(ticks(zone.version) && integer(zone.width) && zone.width > 0 && zone.width <= 32 && integer(zone.height) &&
    zone.height > 0 && zone.height <= 32 && Array.isArray(zone.walkable) && zone.walkable.length === zone.width * zone.height &&
    Array.from(zone.walkable).every(cell => typeof cell === 'boolean'), 'zone grid')
  const floor = (p: Vec2) => record(p) && nonnegative(p.x) && p.x < zone.width && nonnegative(p.z) && p.z < zone.height &&
    zone.walkable[Math.floor(p.z) * zone.width + Math.floor(p.x)]
  definitions(zone.sockets, s => contentCheck(id(s.enemyId) && floor(s.pos), 'spawn socket'))
  definitions(zone.interactables, i => contentCheck(['objective', 'waypoint', 'exit'].includes(i.kind) && floor(i.pos) &&
    (i.kind === 'exit' ? id(i.destination!) && id(i.arrivalId!) : i.destination === undefined && i.arrivalId === undefined), 'interactable'))
  const points = [...zone.sockets, ...zone.interactables]
  contentCheck(unique(points.map(p => p.id)) && unique(zone.sockets.map(s => Math.floor(s.pos.x) + ',' + Math.floor(s.pos.z))) &&
    zone.sockets.length <= 60, 'zone identities/capacity')
  const first = points[0]?.pos
  if (!first) return
  const queue = [Math.floor(first.z) * zone.width + Math.floor(first.x)], reached = new Set(queue)
  for (let i = 0; i < queue.length; i++) {
    const cell = queue[i]!, x = cell % zone.width, z = Math.floor(cell / zone.width)
    for (const [dx, dz] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
      const nx = x + dx, nz = z + dz, next = nz * zone.width + nx
      if (nx < 0 || nx >= zone.width || nz < 0 || nz >= zone.height || !zone.walkable[next] || reached.has(next)) continue
      reached.add(next)
      queue.push(next)
    }
  }
  contentCheck(points.every(p => reached.has(Math.floor(p.pos.z) * zone.width + Math.floor(p.pos.x))), 'unreachable portal/socket')
}

function validateEffectCard(card: EffectCard): void {
  contentCheck(id(card.id) && EFFECT_KINDS.includes(card.kind) && integer(card.delayTicks) && ticks(card.lifetimeTicks) &&
    card.delayTicks < card.lifetimeTicks && nonnegative(card.damageFactor) && card.damageFactor <= 1 &&
    Array.isArray(card.children) && card.children.length <= 3 && unique(card.children) && card.children.every(id), 'effect card')
  validateFootprint(card.footprint)
}

const compatibleDrawings: Record<M3FoldDefinition['mechanic']['kind'], ActionMechanic['kind'][]> = {
  splay: ['fold-dart'], through: ['fold-dart', 'lift-print'], after: ['span-cut', 'plinth-blow', 'brace-mark'],
  hinge: ['cast-loop', 'open-hem'], rim: ['lay-bed', 'rill-fan'], catch: ['gather-line', 'lay-bed', 'lift-print']
}

function validateM3(profile: M3Content): void {
  validateM2(profile)
  contentCheck(profile.version === M3_VERSION, 'M3 profile version')
  profile.actions.forEach(validateM3Action)
  profile.itemBases.forEach(validateM3Base)
  for (const action of profile.actions) contentCheck(action.familyId === 'survey-tally' ||
    profile.itemBases.some(b => b.role === 'weapon' && b.familyId === action.familyId), 'action family base')
  for (const fold of profile.folds) {
    validateM3Fold(fold)
    contentCheck(fold.whitelist.every(id => profile.actions.some(a => a.id === id && compatibleDrawings[fold.mechanic.kind].includes(a.mechanic.kind))), 'fold reference')
  }
  const effects = profile.effects ?? []
  definitions(effects, validateEffectCard)
  for (const card of effects) contentCheck(card.children.every(id => effects.some(e => e.id === id && !e.children.length)), 'effect child graph')
  for (const card of [...profile.actions, ...profile.folds]) {
    const ids = card.effectIds ?? []
    contentCheck(Array.isArray(ids) && ids.length <= 3 && unique(ids) && ids.every(id => effects.some(e => e.id === id)), 'card effect references')
  }
  const zones = profile.zones ?? []
  definitions(zones, validateZone)
  const sockets = zones.flatMap(z => z.sockets.map(s => s.id))
  const markers = zones.flatMap(z => z.interactables.filter(i => i.kind === 'waypoint').map(i => i.id))
  const order = profile.repairOrder ?? []
  contentCheck(unique(sockets) && unique(markers) && Array.isArray(order) && unique(order) && order.length <= 4 &&
    order.every(id => id !== 'hem-rest' && markers.includes(id)), 'campaign ids/order')
  for (const zone of zones) for (const i of zone.interactables) {
    const guards = i.guardSocketIds ?? []
    contentCheck(Array.isArray(guards) && unique(guards) && guards.every(id => zone.sockets.some(s => s.id === id)), 'guard references')
  }
  for (const zone of zones) for (const exit of zone.interactables.filter(i => i.kind === 'exit')) {
    contentCheck(zones.some(z => z.id === exit.destination && z.interactables.some(i => i.id === exit.arrivalId)), 'portal destination')
  }
}

/** Dependency-free runtime schemas return detached data after validation. */
function schema<T>(validate: (value: T) => void) {
  return { parse(data: unknown): T { validate(data as T); return structuredClone(data) as T } }
}
export const actionSchema = schema((value: ActionDefinition) =>
  value && ('mechanic' in value || 'familyId' in value) ? validateM3Action(value as M3ActionDefinition) : validateAction(value))
export const foldSchema = schema((value: FoldDefinition) =>
  value && ('mechanic' in value || 'whitelist' in value) ? validateM3Fold(value as M3FoldDefinition) : validateFold(value))
export const graphProfileSchema = schema(validateGraph)
export const itemBaseSchema = schema((value: ItemBase) =>
  value && 'familyId' in value ? validateM3Base(value as M3ItemBase) : validateBase(value))
export const affixSchema = schema(validateAffix)
export const lootTableSchema = schema(validateLoot)
export const m2ContentSchema = schema(validateM2)
export const contentSchema = schema<ValidatedContent>(validateContent)

export const effectCardSchema = schema(validateEffectCard)
export const m3ActionSchema = schema(validateM3Action)
export const m3FoldSchema = schema(validateM3Fold)
export const m3ItemBaseSchema = schema(validateM3Base)
export const m3ContentSchema = schema(validateM3)
