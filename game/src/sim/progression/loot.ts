import { rngFloat, rngInt } from '../core/rng'
import type { AffixDefinition, CharacterState, RolledItem, Vec2, World } from '../core/types'

function weighted<T extends { weight: number }>(world: World, entries: T[]): T {
  let draw = rngFloat(world, 'loot') * entries.reduce((sum, e) => sum + e.weight, 0)
  for (const entry of entries) {
    draw -= entry.weight
    if (draw < 0) return entry
  }
  return entries[entries.length - 1]!
}

function rollDrop(world: World, rank: number, pos: Vec2) {
  const content = world.content.m2!
  const table = content.lootTables.find(t => t.id === 'creaseback') ?? content.lootTables[0]
  if (world.groundDrops.length >= 60 || !table || rngFloat(world, 'loot') >= table.dropChance) return
  const { role } = weighted(world, table.roles)
  const base = content.itemBases.find(b => b.role === role && b.starter)!
  const item: RolledItem = { id: world.nextItemId++, role, baseId: base.id, affixes: [] }
  const rarity = weighted(world, table.rarities)
  const tiers = table.tiers.filter(t => t.unlockRank <= rank)
  const families = content.affixes.filter(f => f.roles.includes(role) && f.tiers.some(t =>
    t.unlockRank <= rank && tiers.some(entry => entry.tier === t.tier)))
  const eligible = (['offensive', 'utility'] as const).filter(category => families.some(f => f.category === category))
  let categories: AffixDefinition['category'][] = rarity.categories
  if (categories.length === 1 && eligible.length) categories = [eligible[rngInt(world, 'loot', eligible.length)]!]
  for (const category of categories) {
    const pool = families.filter(f => f.category === category)
    if (!pool.length) continue
    const family = pool[rngInt(world, 'loot', pool.length)]!
    const entry = weighted(world, tiers.filter(t => family.tiers.some(ft => ft.tier === t.tier && ft.unlockRank <= rank)))
    const tier = family.tiers.find(t => t.tier === entry.tier)!
    const roll = tier.min + rngInt(world, 'loot', tier.max - tier.min + 1)
    item.affixes.push({ category, familyId: family.id, tier: tier.tier, roll })
  }
  world.groundDrops.push({ item, pos: { ...pos } })
}

export function rewardKill(world: World, character: CharacterState, pos: Vec2) {
  character.xp += 20
  while (character.rank < 21 && character.xp >= 60 * character.rank) {
    character.xp -= 60 * character.rank
    character.rank++
    character.points++
  }
  if (character.rank === 21) character.xp = 0
  rollDrop(world, character.rank, pos)
}
