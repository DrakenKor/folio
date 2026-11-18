import melee from '../scenarios/m2-weight-melee.json'
import gale from '../scenarios/m2-gale-cast.json'
import schedule from '../scenarios/m2-balance.json'
import { Button, IDLE_COMMAND, loadCharacter, restore, serialize } from '../src/sim/core'
import { buildScenario } from '../src/sim/scenarios'
import type { CharacterData, Command, CombatContent, EquipmentRole, Loadout, StatModifier, World } from '../src/sim/core'

/** Frozen before M2 implementation; T2.8 executes these fixtures unchanged. */
export const balanceFixtures = [melee, gale] as const
export type BalanceFixture = typeof balanceFixtures[number]

/** Resolve semantic gear descriptions through public content, never guessed family ids. */
export function balanceCharacter(fixture: BalanceFixture, content: CombatContent, seed: number, lootRng: CharacterData['lootRng']): CharacterData {
  if (!content.m2) throw new Error('M2 content required')
  const authored = content.m2
  const items = fixture.gear.map((gear, index) => {
    const role = gear.role as EquipmentRole
    const base = authored.itemBases.find(base => base.role === role && base.starter)
    if (!base) throw new Error(`Missing starter ${role}`)
    const affixes = gear.affixes.map(spec => {
      const requested = spec as { kind: string; damageType?: string; requiredTags?: string[]; types?: string[]; tier: number; roll: number }
      const equalSet = (a: readonly string[], b: readonly string[]) => [...a].sort().join(',') === [...b].sort().join(',')
      const family = authored.affixes.filter(f => f.roles.includes(role) && f.modifier.kind === requested.kind &&
        (!requested.damageType || 'damageType' in f.modifier && f.modifier.damageType === requested.damageType) &&
        (!requested.requiredTags || equalSet(f.modifier.requiredTags, requested.requiredTags)) &&
        (!requested.types || equalSet(f.modifier.types, requested.types))).sort((a, b) => a.id.localeCompare(b.id))[0]
      const tier = family?.tiers.find(t => t.tier === spec.tier)
      if (!family || !tier || spec.roll < tier.min || spec.roll > tier.max) throw new Error(`Frozen gear unavailable: ${role} ${spec.kind}`)
      return { familyId: family.id, category: family.category, tier: 2 as const, roll: spec.roll }
    })
    return { id: index + 1, baseId: base.id, role, affixes }
  })
  const profile = authored.graphProfiles[0]
  if (!profile) throw new Error('Missing graph profile')
  return { contentVersion: authored.version, seed, lootRng: [...lootRng], nextItemId: 6, questFlags: {}, settings: {},
    character: { rank: 21, xp: 0, points: 0, graph: { profileId: profile.id, version: profile.version, seed: fixture.graphSeed,
      allocations: [...fixture.allocations], activeShapes: [...fixture.activeShapes] }, items,
      equipment: Object.fromEntries(items.map(item => [item.role, item.id])) as Record<EquipmentRole, number>, inventory: [], stash: [],
      loadout: [...fixture.loadout] as Loadout, folds: structuredClone(fixture.folds) } }
}

/** Setup happens once before combat; encounter scheduling belongs to m2-balance. */
export function loadBalanceCharacter(fixture: BalanceFixture, content: CombatContent, seed: number, lootRng: CharacterData['lootRng']): World {
  const prepared = loadCharacter(balanceCharacter(fixture, content, seed, lootRng), content).world
  const world = buildScenario('m2-balance', seed)
  const actor = world.entities.find(e => e.id === world.playerId)
  const character = prepared.entities.find(e => e.id === prepared.playerId)
  if (!actor || !character || world.encounter?.phase !== 'active') throw new Error('m2-balance must start an active encounter')
  Object.assign(actor, { character: structuredClone(character.character), health: character.health, maxHealth: character.maxHealth, skills: { ...character.skills } })
  world.rng.loot = [...prepared.rng.loot!]
  world.nextItemId = prepared.nextItemId
  return restore(serialize(world))
}

/** Ordinary movement/aim/buttons only: close or kite, dodge committed nearby telegraphs, repeat the primary action. */
export function balanceCommand(world: Readonly<World>, fixture: BalanceFixture): Command {
  const player = world.entities.find(entity => entity.id === world.playerId)
  if (!player || player.health <= 0) return structuredClone(IDLE_COMMAND)
  const distance = (entity: { pos: { x: number; z: number } }) => (entity.pos.x - player.pos.x) * (entity.pos.x - player.pos.x) + (entity.pos.z - player.pos.z) * (entity.pos.z - player.pos.z)
  const enemies = world.entities.filter(entity => entity.faction !== player.faction && entity.faction !== 'neutral' && entity.health > 0).sort((a, b) => distance(a) - distance(b) || a.id - b.id)
  const target = enemies[0]
  if (!target) return structuredClone(IDLE_COMMAND)
  const dx = target.pos.x - player.pos.x, dz = target.pos.z - player.pos.z
  const range = Math.sqrt(dx * dx + dz * dz), length = Math.max(range, .00001)
  const threat = enemies.some(enemy => distance(enemy) <= fixture.controller.dodgeTelegraphDistance * fixture.controller.dodgeTelegraphDistance &&
    enemy.ai?.phase === 'telegraph' && enemy.ai.ageTicks >= fixture.controller.dodgeTelegraphAge)
  const direction = threat || range < fixture.controller.desiredDistance - .15 ? -1 : range > fixture.controller.desiredDistance + .15 ? 1 : 0
  return { move: { x: direction * dx / length, z: direction * dz / length }, aim: { ...target.pos },
    buttons: (range <= fixture.controller.attackDistance ? Button.Primary : 0) | (threat ? Button.Dodge : 0) }
}

/** Public semantic descriptor for evaluation reports. */
export function fixtureGearBudget(fixture: BalanceFixture): { bases: number; affixes: number; tier: number; modifiers: StatModifier['kind'][] } {
  return { bases: fixture.gear.length, affixes: fixture.gear.reduce((n, item) => n + item.affixes.length, 0), tier: 2,
    modifiers: fixture.gear.flatMap(item => item.affixes.map(affix => affix.kind as StatModifier['kind'])) }
}

/** Twelve frozen trios at fixed ticks, with bounded offsets varying only by evaluation seed. */
export function balanceWaves(seed: number) {
  const waves = schedule.seeds[String(seed) as keyof typeof schedule.seeds]
  if (!waves) throw new RangeError('Balance seeds are frozen to 1–10')
  return structuredClone(waves)
}
