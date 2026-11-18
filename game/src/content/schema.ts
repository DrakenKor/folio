import { ACTION_TAGS, DAMAGE_TYPES, EQUIPMENT_ROLES } from '../sim/core/types'
import type {
  ActionDefinition, ActionTiming, AffixDefinition, CombatContent, DamageValues, FoldDefinition,
  GraphProfile, ItemBase, LootTable, M2Content, SkillDefinition, StatModifier
} from '../sim/core/types'

export type { ActionDefinition, AffixDefinition, FoldDefinition, GraphProfile, ItemBase, LootTable, M2Content } from '../sim/core/types'

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
  if (value.m2 !== undefined) validateM2(value.m2)
  definitions(value.skills, validateSkill)
  definitions(value.enemies, enemy => {
    contentCheck(positive(enemy.maxHealth) && nonnegative(enemy.radius) && nonnegative(enemy.moveSpeed) &&
      nonnegative(enemy.acquireRange) && nonnegative(enemy.attackRange) && enemy.attackRange <= enemy.acquireRange &&
      integer(enemy.deathTicks) && enemy.deathTicks > 0 && [...value.skills, ...(value.m2?.actions ?? [])].some(skill => skill.id === enemy.skillId), 'enemy')
  })
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

/** Dependency-free runtime schemas return detached data after validation. */
function schema<T>(validate: (value: T) => void) {
  return { parse(data: unknown): T { validate(data as T); return structuredClone(data) as T } }
}
export const actionSchema = schema(validateAction)
export const foldSchema = schema(validateFold)
export const graphProfileSchema = schema(validateGraph)
export const itemBaseSchema = schema(validateBase)
export const affixSchema = schema(validateAffix)
export const lootTableSchema = schema(validateLoot)
export const m2ContentSchema = schema(validateM2)
export const contentSchema = schema(validateContent)
