import { describe, expect, it } from 'vitest'
import { contentSchema } from '../../../content/schema'
import { buildScenario } from '../../scenarios'
import { canonical, DAMAGE_TYPES, EQUIPMENT_ROLES } from '../../core'
import type { StatModifier } from '../../core'
import { balanceCharacter, balanceCommand, balanceFixtures, balanceWaves, fixtureGearBudget, loadBalanceCharacter } from '../../../../tools/m2-fixtures'
import { legalVertices, neighbours } from './graph-oracle'
import { actions, folds, succeeds } from './fixtures'

/** Authored content is observed through the public scenario boundary. */
function authored() {
  const world = succeeds('m2-clearing content dispatch', () => buildScenario('m2-clearing', 7))
  expect(world.content.m2, 'scenario must expose authored M2 content').toBeDefined()
  return world.content.m2!
}
const withoutId = ({ id: _id, ...modifier }: StatModifier) => modifier

describe('M2 authored content contracts', () => {
  it('C01 eight original actions, twelve original folds, one graph and five starter roles', () => {
    const content = authored()
    expect(content.actions.map(a => a.id).sort()).toEqual(actions().map(a => a.id).sort())
    expect(content.folds.map(f => f.id).sort()).toEqual(folds().map(f => f.id).sort())
    expect(content.graphProfiles).toHaveLength(1)
    for (const role of EQUIPMENT_ROLES) expect(content.itemBases.filter(b => b.role === role && b.starter)).toHaveLength(1)
    expect(JSON.stringify(content)).not.toMatch(/socket|support gem|mana|critical|unique/i)
  })

  it.each(actions())('C02 action $id exact base, tags, geometry, phases; no resource or extra cooldown', expected => {
    const actual = authored().actions.find(a => a.id === expected.id)!
    expect(actual).toMatchObject({ id: expected.id, name: expected.name, baseDamage: expected.baseDamage,
      weaponCoefficient: expected.weaponCoefficient, reach: expected.reach, timing: expected.timing, cooldownTicks: 0, kind: expected.kind })
    expect(actual.tags.slice().sort()).toEqual(expected.tags.slice().sort())
    if (actual.kind === 'melee' && expected.kind === 'melee') expect(actual.arcRadians).toBeCloseTo(expected.arcRadians)
    if (actual.kind === 'projectile' && expected.kind === 'projectile') expect(actual).toMatchObject({ speed: expected.speed, radius: expected.radius, lifetimeTicks: expected.lifetimeTicks })
  })

  it.each(folds())('C03 fold $id exact handle/tension/compatibility and fixed gain/price', expected => {
    const actual = authored().folds.find(f => f.id === expected.id)!
    const { modifiers: _mods, ...card } = expected
    expect(actual).toMatchObject(card)
    const ordered = (modifiers: StatModifier[]) => modifiers.map(withoutId).sort((a, b) => canonical(a).localeCompare(canonical(b)))
    expect(ordered(actual.modifiers)).toEqual(ordered(expected.modifiers))
  })

  it('C04 graph radius seven, exactly six seeded families and all twelve orientation bargains', () => {
    const graph = authored().graphProfiles[0]!
    expect(graph.radius).toBe(7); expect(graph.version).toBeGreaterThan(0)
    expect(graph.families).toHaveLength(6)
    const modifiers = graph.families.flatMap(f => f.modifiers)
    expect(modifiers).toHaveLength(6)
    expect(modifiers.filter(m => m.kind === 'health').map(m => m.value)).toEqual([4])
    expect(modifiers.filter(m => m.kind === 'boost').map(m => m.value)).toEqual(Array(5).fill(.05))
    expect(modifiers.filter(m => m.kind === 'boost' && m.types.length).flatMap(m => m.types).sort()).toEqual([...DAMAGE_TYPES].sort())
    expect(modifiers.filter(m => m.kind === 'boost' && m.requiredTags.length).flatMap(m => m.requiredTags).sort()).toEqual(['cast', 'melee'])
    const tagFilters = ['melee', 'cast', 'area', 'projectile', null, null]
    for (const bargain of graph.bargains) for (const [kind, factor] of [['rhombus', 1.1], ['hexagon', 1.15]] as const) {
      const mods = bargain[kind]; expect(mods).toHaveLength(2)
      const gain = mods.find(m => m.kind === 'multiplier')!
      expect(gain.value).toBe(factor)
      expect(gain.requiredTags).toEqual(tagFilters[bargain.orientation] ? [tagFilters[bargain.orientation]] : [])
      expect(gain.types).toEqual(bargain.orientation === 4 ? ['heat'] : bargain.orientation === 5 ? ['gale'] : [])
      const price = mods.find(m => m !== gain)!
      const expected = [
        { kind: 'reachMultiplier', value: .9, requiredTags: ['projectile'] },
        { kind: 'reachMultiplier', value: .9, requiredTags: ['melee'] },
        { kind: 'healthMultiplier', value: .9 }, { kind: 'dodgeCooldown', value: 6 },
        { kind: 'recovery', value: 3 }, { kind: 'reachMultiplier', value: .9, requiredTags: ['melee'] }
      ][bargain.orientation]!
      expect(price).toMatchObject(expected)
    }
  })

  it('C05 Shortblade/Shield/Coat/Boots/Tally implicit bases, no mesh or multiplier/conversion affix', () => {
    const content = authored()
    const starter = (role: string) => content.itemBases.find(b => b.starter && b.role === role)!
    expect(starter('weapon')).toMatchObject({ name: 'Shortblade', weaponDamage: { weight: 24, heat: 0, gale: 0 } })
    expect(starter('offhand').modifiers).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'health', value: 8 }), expect.objectContaining({ kind: 'reduction', damageType: 'weight', value: .05 })]))
    expect(starter('coat').modifiers).toEqual([expect.objectContaining({ kind: 'health', value: 20 })])
    expect(starter('boots').modifiers).toEqual([expect.objectContaining({ kind: 'movement', value: .05 })])
    expect(starter('survey-tally').modifiers).toEqual([expect.objectContaining({ kind: 'flat', damageType: 'weight', value: 2, requiredTags: ['cast'] })])
    for (const affix of content.affixes) {
      expect(['conversion', 'multiplier', 'healthMultiplier', 'reachMultiplier']).not.toContain(affix.modifier.kind)
      if (affix.roles.includes('offhand') || affix.roles.includes('boots')) expect(affix.category).toBe('utility')
    }
  })

  it('C06 bible and additional tier magnitudes, unlocks 1/5/10 and recovery utility routing', () => {
    const content = authored(); expect(content.affixes.length).toBeGreaterThan(0)
    const present = new Set<string>()
    for (const family of content.affixes) {
      const m = family.modifier; present.add(m.kind)
      const ranges = m.kind === 'flat' ? (m.damageType === 'weight' && m.requiredTags.includes('weapon') ? [[4, 6], [7, 10], [11, 14]] : [[2, 3], [4, 5], [6, 8]]) :
        m.kind === 'boost' ? (m.requiredTags.length ? [[8, 12], [13, 18], [19, 24]] : [[4, 6], [7, 9], [10, 12]]) :
        m.kind === 'health' ? [[8, 12], [13, 18], [19, 26]] : m.kind === 'reach' ? [[4, 6], [7, 9], [10, 12]] :
          ['movement', 'reduction'].includes(m.kind) ? [[2, 3], [4, 5], [6, 8]] : [[1, 1], [2, 2], [3, 3]]
      expect(family.tiers.map(t => [t.min, t.max])).toEqual(ranges)
      expect(family.tiers.map(t => t.unlockRank)).toEqual([1, 5, 10])
      expect(Math.abs(family.valuePerPoint)).toBe(['boost', 'movement', 'reduction', 'reach'].includes(m.kind) ? .01 : 1)
      if (['recovery', 'dodgeRecovery', 'dodgeCooldown'].includes(m.kind)) expect(family.valuePerPoint).toBe(-1)
      if (m.kind === 'recovery') expect(family.roles).toEqual(['weapon'])
      if (m.kind === 'dodgeRecovery') expect(family.roles).toEqual(['offhand'])
      if (m.kind === 'dodgeCooldown') expect(family.roles).toEqual(['boots'])
    }
    for (const kind of ['flat', 'boost', 'health', 'reach', 'movement', 'reduction', 'recovery', 'dodgeRecovery', 'dodgeCooldown']) expect(present).toContain(kind)
  })

  it('C07 loot 50%, equal roles, rarity 50/35/15 and tiers 70/25/5; authored schemas detach', () => {
    const content = authored()
    for (const table of content.lootTables) {
      expect(table.dropChance).toBe(.5); expect(table.roles.map(r => r.role).sort()).toEqual([...EQUIPMENT_ROLES].sort())
      expect(new Set(table.roles.map(r => r.weight)).size).toBe(1)
      const rarity = table.rarities.map(r => r.weight); expect(rarity.map(w => w / rarity.reduce((a, b) => a + b, 0))).toEqual([.5, .35, .15])
      expect(table.tiers.map(t => t.unlockRank)).toEqual([1, 5, 10])
      const weights = table.tiers.map(t => t.weight); expect(weights.map(w => w / weights.reduce((a, b) => a + b, 0))).toEqual([.7, .25, .05])
    }
    const world = succeeds('m2-clearing', () => buildScenario('m2-clearing', 7))
    const copy = contentSchema.parse(world.content); expect(copy).toEqual(world.content); expect(copy).not.toBe(world.content)
  })
  it('C08 frozen balance builds use legal 24-node paths, two disjoint marked shapes and equal five-base/eight-affix tier-2 budget', () => {
    const legal = new Set(legalVertices())
    for (const fixture of balanceFixtures) {
      expect(fixture.allocations).toHaveLength(24); expect(new Set(fixture.allocations).size).toBe(24)
      const allocated = new Set(['0,0'])
      for (const node of fixture.allocations) {
        expect(legal).toContain(node)
        const [i, j] = node.split(',').map(Number)
        expect(neighbours.some(([di, dj]) => allocated.has(`${i! + di},${j! + dj}`))).toBe(true)
        allocated.add(node)
      }
      expect(fixture.activeShapes).toHaveLength(2)
      expect(fixtureGearBudget(fixture)).toMatchObject({ bases: 5, affixes: 8, tier: 2 })
      expect(fixture.seeds).toEqual([1,2,3,4,5,6,7,8,9,10]); expect(fixture.ticks).toBe(7200); expect(fixture.waves).toBe(12)
      expect(fixture.gate).toEqual({ minimumKills: 36, minimumHealthFraction: .25, minimumSuccessfulSeeds: 8 })
      for (const seed of fixture.seeds) {
        const waves = balanceWaves(seed); expect(waves).toHaveLength(12)
        expect(waves.map(w => w.tick)).toEqual(Array.from({ length: 12 }, (_, i) => i * 600))
        expect(waves.flatMap(w => w.positions)).toHaveLength(36)
        for (const wave of waves) for (const [i, point] of wave.positions.entries()) {
          expect(Math.abs(point.x - [2,3,3][i]!)).toBeLessThanOrEqual(.300000001)
          expect(Math.abs(point.z - [0,2,-2][i]!)).toBeLessThanOrEqual(.300000001)
        }
      }
    }
    expect(balanceFixtures[0].loadout[0]).toBe('span-cut'); expect(balanceFixtures[1].loadout[0]).toBe('rill-fan')
    expect(balanceFixtures[0].allocations.filter(node => balanceFixtures[1].allocations.includes(node))).toHaveLength(2)
    expect(balanceFixtures[0].gear).toEqual(balanceFixtures[1].gear)
  })

  it('C09 frozen semantic gear resolves to legal public content; controllers emit ordinary commands only', () => {
    const world = succeeds('balance public content', () => buildScenario('m2-clearing', 7))
    for (const fixture of balanceFixtures) {
      const data = succeeds('frozen character projection', () => balanceCharacter(fixture, world.content, 7, world.rng.loot!))
      expect(data.character.points + data.character.graph.allocations.length).toBe(24)
      const ready = succeeds('frozen balance setup', () => loadBalanceCharacter(fixture, world.content, 7, world.rng.loot!))
      expect(ready.scenario).toBe('m2-balance'); expect(ready.encounter!.phase).toBe('active')
      expect(ready.entities.find(e => e.id === ready.playerId)!.character).toEqual(data.character)
      const command = balanceCommand(ready, fixture)
      expect(Object.keys(command).sort()).toEqual(['aim', 'buttons', 'move'])
      expect(command.buttons & ~5).toBe(0)
    }
  })

})
