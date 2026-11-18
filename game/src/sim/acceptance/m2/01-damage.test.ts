import { describe, expect, it } from 'vitest'
import { createWorld, inspectStats, previewAction, serialize } from '../../core'
import type { DamageValues, StatModifier } from '../../core'
import { conversion, edit, fixture, flat, hit, mod, neutralContent, preview, reduction, succeeds, target, value, zero } from './fixtures'

const bible = [flat('a-flat', 'weight', 20), mod('b-generic', 'boost', .4), mod('c-weapon', 'boost', .25, ['weapon']),
  mod('d-factor', 'multiplier', 1.2), mod('e-factor', 'multiplier', 1.3), mod('f-excluded', 'boost', .9, ['projectile'])]
const goldens: Array<{ name: string; base: DamageValues; mods: StatModifier[]; hit: number; stages?: Partial<DamageValues>; defence?: StatModifier[] }> = [
  { name: 'D01 Bible A additive boosts and independent multipliers = 309', base: { ...zero(), weight: 100 }, mods: bible, hit: 309, stages: { weight: 308.88 } },
  { name: 'D02 Bible B final-type scaling = 388', base: { ...zero(), weight: 100 }, mods: [...bible, conversion('g-convert', 'weight', 'heat', .4), mod('h-weight', 'boost', .5, [], ['weight']), mod('i-heat', 'boost', .3, [], ['heat'])], hit: 388, stages: { weight: 241.488, heat: 146.016 } },
  { name: 'D03 oversubscribed .8 + .6 conversions = 40 heat + 30 gale', base: { ...zero(), weight: 70 }, mods: [conversion('a', 'weight', 'heat', .8), conversion('b', 'weight', 'gale', .6)], hit: 70, stages: { weight: 0, heat: 40, gale: 30 } },
  { name: 'D04 simultaneous original sources never reconvert = 170', base: { weight: 100, heat: 20, gale: 0 }, mods: [conversion('a', 'weight', 'heat', 1), conversion('b', 'heat', 'gale', 1), mod('c', 'boost', .5, [], ['heat'])], hit: 170, stages: { weight: 0, heat: 150, gale: 20 } },
  { name: 'D05 typed flat, weapon AND heat, mismatched cast exclusion', base: { ...zero(), weight: 10 }, mods: [flat('a', 'heat', 10), mod('b', 'boost', 1, ['weapon'], ['heat']), mod('c', 'boost', 100, ['cast'], ['heat'])], hit: 30, stages: { weight: 10, heat: 20 } },
  { name: 'D06 OR type set AND required tags each instance once', base: { weight: 10, heat: 10, gale: 10 }, mods: [mod('a', 'boost', .5, ['weapon', 'melee'], ['weight', 'heat']), mod('b', 'multiplier', 2)], hit: 80, stages: { weight: 30, heat: 30, gale: 20 } },
  { name: 'D07 .4 weight + .4 heat rounds only final sum = 1', base: { weight: .4, heat: .4, gale: 0 }, mods: [], hit: 1 },
  { name: 'D08 negative additive pool permits zero', base: { ...zero(), weight: 100 }, mods: [mod('a', 'boost', -2)], hit: 0 },
  { name: 'D09 zero multiplier permits zero', base: { ...zero(), weight: 100 }, mods: [mod('a', 'multiplier', 0)], hit: 0 },
  { name: 'D10 reduction below zero clamps to zero', base: { ...zero(), weight: 100 }, mods: [], defence: [reduction('a', 'weight', -.5)], hit: 100 },
  { name: 'D11 reduction above .75 clamps to .75', base: { ...zero(), weight: 100 }, mods: [], defence: [reduction('a', 'weight', 1.5)], hit: 25 },
  { name: 'D12 fractional sub-half hit has no minimum-one rule', base: { ...zero(), weight: .49 }, mods: [], hit: 0 },
  { name: 'D13 repeated conversion requests sum before normalization', base: { ...zero(), weight: 70 }, mods: [conversion('a', 'weight', 'heat', .4), conversion('b', 'weight', 'heat', .4), conversion('c', 'weight', 'gale', .6)], hit: 70, stages: { heat: 40, gale: 30 } }
]

function damageFixture(spec: typeof goldens[number], health: number) {
  const content = neutralContent()
  content.m2!.itemBases[0]!.weaponDamage = spec.base
  for (const family of content.m2!.graphProfiles[0]!.families) family.modifiers = spec.mods
  const { world, player } = fixture(content)
  player.character!.graph.allocations = ['1,0']; player.character!.points = 3
  const victim = target(world, health)
  if (spec.defence) {
    const profile = structuredClone(content.m2!.graphProfiles[0]!)
    profile.id = 'qa-defender'
    for (const family of profile.families) family.modifiers = spec.defence
    world.content.m2!.graphProfiles.push(profile)
    victim.character = structuredClone(player.character!)
    victim.character.graph.profileId = profile.id
    victim.character.items[0]!.id = 2; victim.character.equipment.weapon = 2
    world.nextItemId = 3
  }
  return { world, player, victim }
}

describe('M2 damage through public contact and preview', () => {
  for (const spec of goldens) it(spec.name, () => {
    for (const health of [10000, 1]) {
      const { world, player, victim } = damageFixture(spec, health)
      const shown = preview(world, player, 'span-cut', victim)
      expect(shown.damage.calculated).toBe(spec.hit)
      expect(shown.damage.applied).toBe(Math.min(spec.hit, health))
      for (const [type, amount] of Object.entries(spec.stages ?? {})) expect(shown.damage.postDefence[type as keyof DamageValues]).toBeCloseTo(amount, 9)
      if (spec.name.startsWith('D03')) {
        expect(shown.damage.conversions.find(c => c.to === 'heat')!.effective).toBeCloseTo(4 / 7)
        expect(shown.damage.conversions.find(c => c.to === 'gale')!.effective).toBeCloseTo(3 / 7)
      }
      const events = hit(world, player, victim)
      expect(victim.health).toBe(health - Math.min(spec.hit, health))
      if (spec.hit > 0) expect(events).toEqual([expect.objectContaining({ amount: Math.min(spec.hit, health), health: victim.health })])
      else expect(events.every(event => event.amount === 0)).toBe(true)
    }
  })

  it('D14 Bible closed shape 127 versus open route 115', () => {
    for (const closed of [false, true]) {
      const content = neutralContent(); content.m2!.itemBases[0]!.weaponDamage.weight = 100
      const { world, player } = fixture(content, true)
      for (const nodeId of closed ? ['1,0', '1,1', '0,1'] : ['1,0', '2,0', '3,0']) edit(world, { type: 'allocate', nodeId })
      if (closed) edit(world, { type: 'activateShape', shapeId: 'rhombus-0', active: true })
      const victim = target(world)
      const shown = preview(world, player, 'span-cut', victim)
      expect(shown.damage.calculated).toBe(closed ? 127 : 115)
      edit(world, { type: 'beginEncounter' })
      expect(hit(world, player, victim)[0]).toMatchObject({ amount: closed ? 127 : 115 })
    }
  })

  it('D15 Bible shortblade 32 or 40; weapon coefficient precedes flats; casts exclude sword', () => {
    for (const boosted of [false, true]) {
      const content = neutralContent()
      content.m2!.itemBases[0]!.modifiers = [flat('sword-flat', 'weight', 8, ['weapon'])]
      for (const family of content.m2!.graphProfiles[0]!.families) family.modifiers = boosted ? [mod('melee', 'boost', .25, ['melee'])] : []
      const { world, player } = fixture(content)
      player.character!.graph.allocations = ['1,0']; player.character!.points = 3
      const victim = target(world)
      expect(preview(world, player, 'span-cut', victim).damage.calculated).toBe(boosted ? 40 : 32)
      expect(preview(world, player, 'fold-dart', victim).damage.calculated).toBe(16)
      expect(preview(world, player, 'plinth-blow', victim).damage.baseAndFlat.weight).toBe(44)
      expect(hit(world, player, victim)[0]).toMatchObject({ amount: boosted ? 40 : 32 })
    }
  })

  it('D16 stable instance-id arithmetic, detached cold/warm queries and no RNG mutation', () => {
    const spec = { ...goldens[0]!, mods: [...bible, mod('z-tiny', 'boost', 1e-14)] }
    const { world, player, victim } = damageFixture(spec, 10000)
    const before = serialize(world)
    const first = preview(world, player, 'span-cut', victim)
    expect(preview(world, player, 'span-cut', victim)).toEqual(first)
    expect(serialize(world)).toBe(before)
    const stats = value(inspectStats(world, player.id)); stats.sources.length = 0
    first.recipe.modifiers.length = 0
    expect(serialize(world)).toBe(before)
    const reordered = damageFixture({ ...spec, mods: spec.mods.slice().reverse() }, 10000)
    expect(preview(reordered.world, reordered.player, 'span-cut', reordered.victim).damage).toEqual(preview(world, player, 'span-cut', victim).damage)
    expect(value(previewAction(world, player.id, 'span-cut', victim.id)).stats.sources.length).toBeGreaterThan(0)
  })

  it.each([
    conversion('bad', 'weight', 'heat', -0.1), conversion('bad', 'weight', 'heat', 1.1),
    { ...conversion('bad', 'weight', 'heat', .5), from: 'heat', to: 'weight' },
    { ...conversion('bad', 'weight', 'heat', .5), to: 'weight' },
    mod('bad', 'multiplier', -1), flat('bad', 'heat', -1)
  ])('D17 invalid conversion/factor/base %j rejected before world construction', bad => {
    const content = neutralContent(); content.m2!.graphProfiles[0]!.families[0]!.modifiers = [bad as StatModifier]
    expect(() => createWorld(7, undefined, content)).toThrow(/Invalid content/)
    content.m2!.graphProfiles[0]!.families[0]!.modifiers = []
    content.m2!.actions[0]!.baseDamage.weight = -1
    expect(() => createWorld(7, undefined, content)).toThrow(/Invalid content/)
  })

  it('D18 unknown public query ids return typed rejection without mutation', () => {
    const { world, player } = fixture(); const victim = target(world); const before = serialize(world)
    expect(inspectStats(world, 99999)).toMatchObject({ ok: false, reason: 'no-actor' })
    expect(previewAction(world, player.id, 'absent', victim.id)).toMatchObject({ ok: false, reason: 'unknown-skill' })
    expect(previewAction(world, player.id, 'span-cut', 99999)).toMatchObject({ ok: false, reason: 'unknown-target' })
    expect(succeeds('serialize', () => serialize(world))).toBe(before)
  })
})
