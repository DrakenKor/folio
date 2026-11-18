import { expect, it } from 'vitest'
import { edit, hit, preview, target, ticks } from '../acceptance/m2/fixtures'
import { restore, serialize } from '../core'
import { buildScenario, spawnCreaseback } from '../scenarios'

it('captures Draftbind on a Creaseback strike and applies current shield and affix reductions at contact', () => {
  const world = buildScenario('m2-clearing', 7)
  const player = world.entities[0]!
  world.encounter!.phase = 'active'
  player.character!.rank = 5
  player.character!.points = 8
  const enemy = spawnCreaseback(world, { x: player.pos.x + 1, z: player.pos.z })
  world.ailments.push({ id: 'draftbind', targetId: enemy.id, sourceId: player.id, appliedTick: 0, expiresTick: 5, nextPulseTick: null })
  ticks(world, 5)
  expect(world.ailments).toEqual([])
  const resumed = restore(serialize(world))
  const [defender, striker] = resumed.entities
  const shield = defender!.character!.items.find(item => item.role === 'offhand')!
  shield.affixes.push({ familyId: 'weight-reduction', category: 'utility', tier: 2, roll: 5 })
  const shown = preview(resumed, striker!, 'creaseback-strike', defender!)
  expect(shown.damage).toMatchObject({ baseAndFlat: { weight: 20 }, multipliers: { weight: .9 }, reductions: { weight: .1 }, applied: 16 })
  expect(ticks(resumed, 24)).toContainEqual(expect.objectContaining({ type: 'damage', actorId: striker!.id, targetId: defender!.id, amount: 16 }))
})

it('rounds the rank-ten Shortblade and Short Pleat Plinth Blow from 57.5 to 58', () => {
  const world = buildScenario('m2-clearing', 7)
  const player = world.entities[0]!
  const character = player.character!
  character.rank = 10
  character.points = 13
  character.items.find(item => item.role === 'weapon')!.affixes.push({ familyId: 'weapon-weight-flat', category: 'offensive', tier: 3, roll: 14 })
  edit(world, { type: 'setFolds', skillId: 'plinth-blow', foldIds: ['short-pleat'] })
  edit(world, { type: 'beginEncounter' })
  const victim = target(world, 100, { x: player.pos.x + 1, z: player.pos.z })
  expect(preview(world, player, 'plinth-blow', victim).damage).toMatchObject({ postDefence: { weight: 57.5 }, calculated: 58 })
  expect(hit(world, player, victim, 'plinth-blow')[0]?.amount).toBe(58)
})
