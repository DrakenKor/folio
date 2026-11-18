import { EQUIPMENT_ROLES } from '../../sim/core/types'
import type { AffixTier, DamageType, EquipmentRole, StatModifier } from '../../sim/core/types'
import type { AffixDefinition, ItemBase, LootTable } from '../schema'
import { modifierScope } from './modifiers'

export const SHORTBLADE_WEIGHT = 24

const NO_WEAPON_DAMAGE = { weight: 0, heat: 0, gale: 0 }

export const itemBases: ItemBase[] = [
  { id: 'shortblade', name: 'Shortblade', role: 'weapon', starter: true,
    weaponDamage: { ...NO_WEAPON_DAMAGE, weight: SHORTBLADE_WEIGHT }, modifiers: [] },
  { id: 'field-shield', name: 'Field Shield', role: 'offhand', starter: true, weaponDamage: { ...NO_WEAPON_DAMAGE }, modifiers: [
    { ...modifierScope('field-shield-health'), kind: 'health', value: 8 },
    { ...modifierScope('field-shield-weight-reduction'), kind: 'reduction', damageType: 'weight', value: .05 }
  ] },
  { id: 'shelter-coat', name: 'Shelter Coat', role: 'coat', starter: true, weaponDamage: { ...NO_WEAPON_DAMAGE },
    modifiers: [{ ...modifierScope('shelter-coat-health'), kind: 'health', value: 20 }] },
  { id: 'way-boots', name: 'Way Boots', role: 'boots', starter: true, weaponDamage: { ...NO_WEAPON_DAMAGE },
    modifiers: [{ ...modifierScope('way-boots-movement'), kind: 'movement', value: .05 }] },
  { id: 'survey-tally', name: 'Survey Tally', role: 'survey-tally', starter: true, weaponDamage: { ...NO_WEAPON_DAMAGE },
    modifiers: [{ ...modifierScope('survey-tally-weight', ['cast']), kind: 'flat', damageType: 'weight', value: 2 }] }
]

type Range = [min: number, max: number]
const UNLOCKS = [
  { tier: 1, unlockRank: 1 }, { tier: 2, unlockRank: 5 }, { tier: 3, unlockRank: 10 }
] as const

function tiers(rank1: Range, rank5: Range, rank10: Range): AffixTier[] {
  const ranges = [rank1, rank5, rank10] as const
  return UNLOCKS.map((entry, index) => ({ ...entry, min: ranges[index]![0], max: ranges[index]![1] }))
}

const WEAPON_WEIGHT_TIERS = tiers([4, 6], [7, 10], [11, 14])
const TYPED_TIERS = tiers([2, 3], [4, 5], [6, 8])
const DELIVERY_TIERS = tiers([8, 12], [13, 18], [19, 24])
const COAT_AND_REACH_TIERS = tiers([4, 6], [7, 9], [10, 12])
const HEALTH_TIERS = tiers([8, 12], [13, 18], [19, 26])
const TIMING_TIERS = tiers([1, 1], [2, 2], [3, 3])

const DAMAGE_LABELS = { weight: 'Weight', heat: 'Heat', gale: 'Gale' } satisfies Record<DamageType, string>

function flatAffix(type: DamageType, delivery: 'weapon' | 'cast', role: EquipmentRole): AffixDefinition {
  const id = `${delivery}-${type}-flat`
  return {
    id, name: `${DAMAGE_LABELS[type]} for ${delivery === 'weapon' ? 'Weapon Actions' : 'Casts'}`,
    category: 'offensive', roles: [role], valuePerPoint: 1,
    modifier: { ...modifierScope(id, [delivery]), kind: 'flat', damageType: type, value: 0 },
    tiers: delivery === 'weapon' && type === 'weight' ? WEAPON_WEIGHT_TIERS : TYPED_TIERS
  }
}

function reductionAffix(type: DamageType): AffixDefinition {
  const id = `${type}-reduction`
  return {
    id, name: `${DAMAGE_LABELS[type]} Reduction`, category: 'utility', roles: ['offhand', 'coat'], valuePerPoint: .01,
    modifier: { ...modifierScope(id), kind: 'reduction', damageType: type, value: 0 }, tiers: TYPED_TIERS
  }
}

const families: AffixDefinition[] = [
  flatAffix('weight', 'weapon', 'weapon'),
  flatAffix('heat', 'weapon', 'weapon'),
  flatAffix('gale', 'weapon', 'weapon'),
  flatAffix('weight', 'cast', 'survey-tally'),
  flatAffix('heat', 'cast', 'survey-tally'),
  flatAffix('gale', 'cast', 'survey-tally'),
  { id: 'weapon-melee-boost', name: 'Melee Boost', category: 'offensive', roles: ['weapon'], valuePerPoint: .01,
    modifier: { ...modifierScope('weapon-melee-boost', ['melee']), kind: 'boost', value: 0 }, tiers: DELIVERY_TIERS },
  { id: 'tally-cast-boost', name: 'Cast Boost', category: 'offensive', roles: ['survey-tally'], valuePerPoint: .01,
    modifier: { ...modifierScope('tally-cast-boost', ['cast']), kind: 'boost', value: 0 }, tiers: DELIVERY_TIERS },
  { id: 'coat-damage-boost', name: 'Damage Boost', category: 'offensive', roles: ['coat'], valuePerPoint: .01,
    modifier: { ...modifierScope('coat-damage-boost'), kind: 'boost', value: 0 }, tiers: COAT_AND_REACH_TIERS },
  { id: 'health', name: 'Health', category: 'utility', roles: ['weapon', 'offhand', 'coat', 'boots'], valuePerPoint: 1,
    modifier: { ...modifierScope('item-health'), kind: 'health', value: 0 }, tiers: HEALTH_TIERS },
  reductionAffix('weight'),
  reductionAffix('heat'),
  reductionAffix('gale'),
  { id: 'movement', name: 'Movement Speed', category: 'utility', roles: ['boots'], valuePerPoint: .01,
    modifier: { ...modifierScope('movement'), kind: 'movement', value: 0 }, tiers: TYPED_TIERS },
  { id: 'projectile-reach', name: 'Projectile Reach', category: 'utility', roles: ['survey-tally'], valuePerPoint: .01,
    modifier: { ...modifierScope('projectile-reach', ['projectile']), kind: 'reach', value: 0 }, tiers: COAT_AND_REACH_TIERS },
  { id: 'weapon-recovery', name: 'Action Recovery', category: 'utility', roles: ['weapon'], valuePerPoint: -1,
    modifier: { ...modifierScope('weapon-recovery'), kind: 'recovery', value: 0 }, tiers: TIMING_TIERS },
  { id: 'dodge-recovery', name: 'Dodge Recovery', category: 'utility', roles: ['offhand'], valuePerPoint: -1,
    modifier: { ...modifierScope('dodge-recovery'), kind: 'dodgeRecovery', value: 0 }, tiers: TIMING_TIERS },
  { id: 'dodge-cooldown', name: 'Dodge Cooldown', category: 'utility', roles: ['boots'], valuePerPoint: -1,
    modifier: { ...modifierScope('dodge-cooldown'), kind: 'dodgeCooldown', value: 0 }, tiers: TIMING_TIERS }
]

export const affixes = families.map(family => ({ ...family, tiers: family.tiers.map(tier => ({ ...tier })) }))

export const creasebackLoot: LootTable = {
  id: 'creaseback', dropChance: .5,
  roles: EQUIPMENT_ROLES.map(role => ({ role, weight: 1 })),
  rarities: [
    { categories: [], weight: 50 },
    { categories: ['offensive'], weight: 35 },
    { categories: ['offensive', 'utility'], weight: 15 }
  ],
  tiers: UNLOCKS.map((entry, index) => ({ ...entry, weight: [70, 25, 5][index]! }))
}
