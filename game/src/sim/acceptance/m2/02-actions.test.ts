import { describe, expect, it } from 'vitest'
import { Button, IDLE_COMMAND, inspectStats, previewBuild, restore, serialize } from '../../core'
import type { AilmentState, Operation } from '../../core'
import { actionCards, edit, fixture, hit, neutralContent, preview, target, tick, ticks, value, zero } from './fixtures'

const buttons = [Button.Primary, Button.Secondary, Button.Skill1, Button.Skill2, Button.Skill3, Button.Skill4]

function pulseFixture(id: AilmentState['id'] = 'emberprint') {
  const { world, player } = fixture()
  const victim = target(world)
  world.tick = 1
  world.ailments = [id === 'emberprint' ? { id, sourceId: player.id, targetId: victim.id, appliedTick: 1, expiresTick: 121, nextPulseTick: 31 } :
    { id, sourceId: player.id, targetId: victim.id, appliedTick: 1, expiresTick: 91, nextPulseTick: null }]
  return { world: restore(serialize(world)), playerId: player.id, victimId: victim.id }
}

describe('M2 actions, folds and captured recipes', () => {
  it.each(actionCards.map(card => [...card] as [string, string, string, number, number, number, number, number, number, number, number, number, number, number]))('A01 action %s uses its immutable delivery, phases and public slot', (id, _name, delivery, weight, heat, gale, coefficient, reach, angle, w, a, r, speed, radius) => {
    const { world, player } = fixture(); player.character!.loadout = [id, null, null, null, null, null]
    const victim = target(world, 1000)
    const shown = preview(world, player, id, victim)
    expect(shown.recipe.tags).toEqual(delivery === 'weapon' ? ['weapon', 'melee', 'area'] : delivery === 'projectile' ? ['cast', 'projectile'] : ['cast', 'area'])
    expect(shown.recipe.sourceDamage).toEqual({ weight: weight + 24 * coefficient, heat, gale })
    expect(shown.recipe.timing).toEqual({ windupTicks: w, activeTicks: a, recoveryTicks: r, moveCancelTicks: 6 })
    expect(shown.recipe.footprint.reach).toBe(reach)
    if (speed) expect(shown.recipe.footprint).toMatchObject({ speed, radius, lifetimeTicks: Math.ceil(60 * reach / speed) })
    else expect(shown.recipe.footprint.arcRadians).toBeCloseTo(angle * Math.PI / 180)
    expect(hit(world, player, victim, id)).toHaveLength(1)
  })

  it('A02 six unique slots reject duplicates/unknown skills and edits require rest', () => {
    const { world } = fixture(neutralContent(), true)
    edit(world, { type: 'setLoadout', slots: ['span-cut', 'fold-dart', 'rill-fan', 'plinth-blow', 'hearth-shard', 'skim-needle'] })
    edit(world, { type: 'setLoadout', slots: ['span-cut', 'span-cut', null, null, null, null] }, 'duplicate-skill')
    edit(world, { type: 'setLoadout', slots: ['unknown', null, null, null, null, null] }, 'unknown-skill')
    edit(world, { type: 'beginEncounter' })
    edit(world, { type: 'setFolds', skillId: 'span-cut', foldIds: [] }, 'requires-rest')
  })

  it('A03 Dodge then six-slot priority; held actions repeat; release suppresses repeats', () => {
    for (let slot = 0; slot < 6; slot++) {
      const { world, player } = fixture()
      const mask = buttons.slice(slot).reduce((a, b) => a | b, 0)
      tick(world, { ...IDLE_COMMAND, buttons: mask, aim: { x: 5, z: 0 } })
      expect(player.action?.id).toBe(player.character!.loadout[slot])
      const events = ticks(world, 150, { ...IDLE_COMMAND, buttons: mask })
      expect(events.filter(e => e.type === 'action' && e.id === player.id).length).toBeGreaterThan(1)
    }
    const { world, player } = fixture()
    tick(world, { ...IDLE_COMMAND, buttons: 127, move: { x: 1, z: 0 } })
    expect(player.action?.id).toBe('dodge')
    expect(ticks(world, 100).filter(e => e.type === 'action')).toHaveLength(0)
  })

  it('A04 cooldown follows action identity when reassigned to a different slot', () => {
    const content = neutralContent(); content.m2!.actions.find(a => a.id === 'span-cut')!.cooldownTicks = 120
    const { world, player } = fixture(content, true)
    player.skillCooldowns['span-cut'] = 80
    edit(world, { type: 'setLoadout', slots: [null, 'span-cut', null, null, null, null] })
    edit(world, { type: 'beginEncounter' })
    expect(tick(world, { ...IDLE_COMMAND, buttons: Button.Secondary }).filter(e => e.type === 'action')).toHaveLength(0)
    expect(player.skillCooldowns['span-cut']).toBeGreaterThan(0)
  })

  const foldCases = [
    ['long-pleat', 'fold-dart', 15, 8, 21, 12.8], ['short-pleat', 'fold-dart', 7.5, 8, 15, 18.4],
    ['stanch-pleat', 'fold-dart', 8.5, 8, 11, 16], ['splay-pleat', 'fold-dart', 10, 8, 15, 7.2],
    ['close-pleat', 'span-cut', 1.7, 6, 12, 28.8], ['broad-pleat', 'rill-fan', 3, 12, 20, 14.4],
    ['fine-pleat', 'fold-dart', 10, 8, 15, 18.4], ['kiln-pleat', 'fold-dart', 10, 8, 21, 16],
    ['vane-pleat', 'fold-dart', 8.5, 8, 15, 16], ['draft-pleat', 'hearth-shard', 8, 12, 21, 18],
    ['ballast-pleat', 'fold-dart', 10, 12, 15, 24], ['hush-pleat', 'fold-dart', 10, 8, 21, 24]
  ] as const
  it.each(foldCases)('A05 fold %s fixes gain, price, timing and unchanged tags', (foldId, skillId, reach, w, r, damage) => {
    const { world, player } = fixture(neutralContent(), true); const victim = target(world)
    const original = preview(world, player, skillId, victim)
    edit(world, { type: 'setFolds', skillId, foldIds: [foldId] })
    const shown = preview(world, player, skillId, victim)
    expect(shown.recipe.tags).toEqual(original.recipe.tags)
    expect(shown.recipe.timing).toMatchObject({ windupTicks: w, recoveryTicks: r, moveCancelTicks: Math.min(r, Math.max(1, 6 + r - original.recipe.timing.recoveryTicks)) })
    expect(shown.recipe.footprint.reach).toBeCloseTo(reach)
    expect(Object.values(shown.damage.postDefence).reduce((a, b) => a + b, 0)).toBeCloseTo(damage)
    if (foldId === 'splay-pleat') expect(shown.recipe.footprint.projectileAngles).toEqual([-18, 0, 18])
    if (foldId === 'fine-pleat') expect(shown.recipe.footprint.radius).toBeCloseTo(.072)
    if (foldId === 'close-pleat') expect(shown.recipe.footprint.arcRadians).toBeCloseTo(70 * Math.PI / 180)
    if (foldId === 'broad-pleat') expect(shown.recipe.footprint.arcRadians).toBeCloseTo(98 * Math.PI / 180)
    edit(world, { type: 'beginEncounter' })
    expect(hit(world, player, victim, skillId)[0]).toMatchObject({ amount: Math.floor(damage + .5) })
  })

  it.each([
    ['fold-dart', ['long-pleat', 'kiln-pleat'], 'tension-limit'],
    ['fold-dart', ['short-pleat', 'stanch-pleat'], 'duplicate-handle'],
    ['rill-fan', ['splay-pleat'], 'incompatible-fold'],
    ['fold-dart', ['close-pleat'], 'incompatible-fold'],
    ['rill-fan', ['kiln-pleat'], 'incompatible-fold'],
    ['fold-dart', ['draft-pleat'], 'incompatible-fold'],
    ['fold-dart', ['absent'], 'unknown-fold']
  ] as const)('A06 reject %s %j atomically with %s', (skillId, foldIds, reason) => {
    const { world, player } = fixture(neutralContent(), true)
    const before = structuredClone({ character: player.character, rng: world.rng })
    edit(world, { type: 'setFolds', skillId, foldIds: [...foldIds] }, reason)
    expect({ character: player.character, rng: world.rng }).toEqual(before)
  })

  it('A07 Long+Splay golden: 15m, 21 recovery, 6 each; three targets and one target dedup', () => {
    for (const wide of [false, true]) {
      const { world, player } = fixture(neutralContent(), true)
      edit(world, { type: 'setFolds', skillId: 'fold-dart', foldIds: ['long-pleat', 'splay-pleat'] })
      const victims = wide ? [target(world, 100, { x: 4, z: -1.3 }), target(world, 100, { x: 4, z: 0 }), target(world, 100, { x: 4, z: 1.3 })] : [target(world, 100, { x: 4, z: 0 }, { radius: 2 })]
      const shown = preview(world, player, 'fold-dart', victims[0]!)
      expect(shown.recipe.footprint).toMatchObject({ reach: 15, lifetimeTicks: 65, projectileAngles: [-18, 0, 18] })
      expect(shown.recipe.timing.recoveryTicks).toBe(21); expect(shown.damage.calculated).toBe(6)
      edit(world, { type: 'beginEncounter' })
      const events = tick(world, { ...IDLE_COMMAND, buttons: Button.Secondary, aim: { x: 8, z: 0 } }).concat(ticks(world, 100))
      expect(events.filter(e => e.type === 'damage')).toHaveLength(victims.length)
      expect(victims.map(v => v.health)).toEqual(victims.map(() => 94))
    }
  })

  it('A08 fan immune contact consumes target membership through action completion', () => {
    const content = neutralContent(); content.dodge.distance = .001
    const { world, player } = fixture(content)
    player.character!.folds['fold-dart'] = ['long-pleat', 'splay-pleat']
    const victim = target(world, 100, { x: 2, z: 0 }, { radius: 1.2 })
    tick(world, { ...IDLE_COMMAND, buttons: Button.Secondary, aim: { x: 8, z: 0 } })
    ticks(world, 8)
    victim.action = { id: 'dodge', kind: 'dodge', startTick: world.tick - 2, ageTicks: 2, direction: 0, hitTargetIds: [], projectileSpawned: false }
    ticks(world, 3)
    expect(world.actionGroups[0]!.hitTargetIds).toEqual([victim.id])
    ticks(world, 77)
    expect(victim.health).toBe(100)
    expect(world.actionGroups).toHaveLength(0)
  })

  it('A09 fold id order, single final phase rounding, phase/cancel floors, sector cap', () => {
    const { world, player } = fixture(neutralContent(), true); const victim = target(world)
    edit(world, { type: 'setFolds', skillId: 'fold-dart', foldIds: ['splay-pleat', 'long-pleat'] })
    const first = preview(world, player, 'fold-dart', victim)
    edit(world, { type: 'setFolds', skillId: 'fold-dart', foldIds: ['long-pleat', 'splay-pleat'] })
    expect(preview(world, player, 'fold-dart', victim)).toEqual(first)
    edit(world, { type: 'setFolds', skillId: 'cairn-wake', foldIds: ['broad-pleat'] })
    expect(preview(world, player, 'cairn-wake', victim).recipe.footprint.arcRadians).toBeCloseTo(2 * Math.PI)
    world.content.m2!.itemBases[0]!.modifiers = [{ id: 'fast', kind: 'recovery', value: -100, types: [], requiredTags: [] }]
    expect(preview(world, player, 'fold-dart', victim).recipe.timing).toMatchObject({ recoveryTicks: 1, moveCancelTicks: 1 })
  })

  it('A10 flight snapshot retains recipe and reads target reduction at contact', () => {
    const { world, player } = fixture()
    const victim = target(world, 100, { x: 8, z: 0 })
    tick(world, { ...IDLE_COMMAND, buttons: Button.Secondary, aim: victim.pos })
    const captured = structuredClone(player.action!.recipe)
    ticks(world, 9)
    expect(world.projectiles[0]!.recipe).toEqual(captured)
    // Two legal continuation fixtures share a flying recipe and differ only in target defence.
    for (const defence of [0, .75]) {
      const data = JSON.parse(serialize(world))
      const defender = data.world.entities.find((e: { id: number }) => e.id === victim.id)
      defender.character = structuredClone(player.character!)
      defender.character.items = [{ id: 2, baseId: 'qa-weapon', role: 'weapon', affixes: [] }, { id: 3, baseId: 'qa-offhand', role: 'offhand', affixes: [] }]
      defender.character.equipment.weapon = 2; defender.character.equipment.offhand = 3
      data.world.nextItemId = 4
      data.world.content.m2.itemBases.find((b: { role: string }) => b.role === 'offhand').modifiers = [{ id: 'defence', kind: 'reduction', damageType: 'weight', value: defence, types: [], requiredTags: [] }]
      const resumed = restore(JSON.stringify(data))
      expect(resumed.projectiles[0]!.recipe).toEqual(captured)
      ticks(resumed, 80)
      expect(resumed.entities.find(e => e.id === victim.id)!.health).toBe(defence ? 96 : 84)
    }
  })

  it('A11 equipment edit invalidating unfolded retained folds rejects with preview and no mutation', () => {
    const content = neutralContent(); content.m2!.itemBases.push({ ...structuredClone(content.m2!.itemBases[0]!), id: 'zero-sword', starter: false, weaponDamage: zero() })
    const { world, player } = fixture(content, true)
    player.character!.folds['span-cut'] = ['kiln-pleat']
    player.character!.items.push({ id: 2, baseId: 'zero-sword', role: 'weapon', affixes: [] }); player.character!.inventory.push(2); world.nextItemId = 3
    const operation: Operation = { type: 'equip', itemId: 2 }
    expect(value(previewBuild(world, operation)).result).toMatchObject({ accepted: false, reason: 'incompatible-fold' })
    const before = structuredClone(player.character)
    edit(world, operation, 'incompatible-fold'); expect(player.character).toEqual(before)
  })
  it('A20 M2 rooting, locked aim, deduped sector and movement cancellation after six recovery ticks', () => {
    const { world, player } = fixture(); const victim = target(world)
    tick(world, { ...IDLE_COMMAND, aim: { x: 10, z: 0 }, buttons: Button.Primary, move: { x: 1, z: 0 } })
    const start = { ...player.pos }, direction = player.action!.direction
    const events = ticks(world, 14, { ...IDLE_COMMAND, aim: { x: 0, z: 10 }, move: { x: 1, z: 0 } })
    expect(player.pos).toEqual(start); expect(player.action!.direction).toBe(direction)
    expect(events.filter(e => e.type === 'damage' && e.targetId === victim.id)).toHaveLength(1)
    tick(world, { ...IDLE_COMMAND, move: { x: 1, z: 0 } })
    expect(player.action).toBeNull(); expect(player.pos.x).toBeGreaterThan(start.x)
  })

  it('A21 recovery and cancellation round once after all deltas', () => {
    const content = neutralContent()
    content.m2!.itemBases[0]!.modifiers = [{ id: 'fractional-recovery', kind: 'recovery', value: -3.6, types: [], requiredTags: [] }]
    const { world, player } = fixture(content); const victim = target(world)
    expect(preview(world, player, 'span-cut', victim).recipe.timing).toMatchObject({ recoveryTicks: 8, moveCancelTicks: 2 })
  })

})

describe('M2 ailments through direct hits and world ticks', () => {
  it.each(['weight', 'heat', 'gale'] as const)('A12 %s threshold uses unrounded post-defence >=12 and refreshes one record', type => {
    for (const magnitude of [11.999, 12]) {
      const content = neutralContent(); content.m2!.itemBases[0]!.weaponDamage = { ...zero(), [type]: magnitude }
      const { world, player } = fixture(content); const victim = target(world)
      hit(world, player, victim)
      expect(world.ailments.map(a => a.id)).toEqual(magnitude === 12 ? [type === 'weight' ? 'burden' : type === 'heat' ? 'emberprint' : 'draftbind'] : [])
      if (magnitude === 12) {
        ticks(world, 30); hit(world, player, victim)
        expect(world.ailments).toHaveLength(1)
        expect(world.ailments[0]!.expiresTick).toBe(world.tick + (type === 'heat' ? 120 : 90))
      }
    }
  })

  it('A13 zero and immune direct hits apply no ailments', () => {
    for (const immune of [false, true]) {
      const content = neutralContent(); if (!immune) content.m2!.itemBases[0]!.weaponDamage = zero()
      const { world, player } = fixture(content); const victim = target(world)
      if (immune) {
        tick(world, { ...IDLE_COMMAND, buttons: Button.Primary, aim: victim.pos }); ticks(world, 4)
        victim.action = { id: 'dodge', kind: 'dodge', startTick: world.tick - 2, ageTicks: 2, direction: 0, hitTargetIds: [], projectileSpawned: false }
        ticks(world, 6)
      } else hit(world, player, victim)
      expect(world.ailments).toEqual([])
    }
  })

  it('A14 Burden ordinary speed .85, exact 90-tick expiry; dodge distance unchanged', () => {
    const { world, player } = fixture(); const victim = target(world, 1000, { x: 100, z: 0 })
    world.tick = 1; world.ailments = [{ id: 'burden', sourceId: victim.id, targetId: player.id, appliedTick: 1, expiresTick: 91, nextPulseTick: null }]
    expect(value(inspectStats(world, player.id)).movementSpeed).toBeCloseTo(2.521 * .85)
    const start = { ...player.pos }
    ticks(world, 10, { ...IDLE_COMMAND, move: { x: 1, z: 0 }, buttons: Button.Dodge })
    expect(player.pos.x - start.x).toBeCloseTo(3)
    ticks(world, 79); expect(world.ailments).toHaveLength(1)
    tick(world); expect(world.ailments).toHaveLength(0)
    expect(value(inspectStats(world, player.id)).movementSpeed).toBeCloseTo(2.521)
  })

  it('A15 Draftbind .90 affects future actions and expires at 90, never rewrites an active recipe', () => {
    const { world, player } = fixture(); const victim = target(world, 100, { x: 8, z: 0 })
    tick(world, { ...IDLE_COMMAND, buttons: Button.Secondary, aim: victim.pos })
    const captured = structuredClone(player.action!.recipe)
    world.ailments = [{ id: 'draftbind', sourceId: victim.id, targetId: player.id, appliedTick: 1, expiresTick: 91, nextPulseTick: null }]
    expect(preview(world, player, 'fold-dart', victim).damage.postDefence.weight).toBeCloseTo(14.4)
    expect(player.action!.recipe).toEqual(captured)
    ticks(world, 80); expect(victim.health).toBe(84)
    ticks(world, 10); expect(world.ailments.filter(a => a.id === 'draftbind')).toHaveLength(0)
    expect(preview(world, player, 'fold-dart', victim).damage.calculated).toBe(16)
  })

  it('A16 Emberprint pulses K+30/60/90/120, pulse precedes expiry and no recursion', () => {
    const { world, victimId } = pulseFixture(); const victim = world.entities.find(e => e.id === victimId)!
    const events = ticks(world, 120)
    expect(events.filter(e => e.type === 'damage').map(e => [e.tick, e.amount])).toEqual([[31, 2], [61, 2], [91, 2], [121, 2]])
    expect(victim.health).toBe(992); expect(world.ailments).toEqual([])
    expect(victim.impactPauseTicks).toBe(0); expect(victim.knockback).toBeNull()
  })

  it('A17 refresh preserves next Emberprint pulse under repeated fast hits', () => {
    const content = neutralContent(); content.m2!.itemBases[0]!.weaponDamage = { ...zero(), heat: 12 }
    content.m2!.actions[0]!.timing = { windupTicks: 1, activeTicks: 1, recoveryTicks: 1, moveCancelTicks: 1 }
    const { world, player } = fixture(content); const victim = target(world)
    hit(world, player, victim); const first = structuredClone(world.ailments[0]!)
    const events = ticks(world, 65, { ...IDLE_COMMAND, buttons: Button.Primary, aim: victim.pos })
    expect(events.filter(e => e.type === 'damage' && e.amount === 2).map(e => e.tick)).toEqual([first.nextPulseTick, first.nextPulseTick! + 30])
    expect(world.ailments).toHaveLength(1)
    expect(world.ailments[0]!.expiresTick).toBeGreaterThan(first.expiresTick)
    expect(victim.health).toBeLessThan(1000 - 12)
  })

  it('A18 pulses use current heat reduction only, ignore dodge, do not interrupt and credit dead source', () => {
    const { world, playerId, victimId } = pulseFixture(); const victim = world.entities.find(e => e.id === victimId)!
    const source = world.entities.find(e => e.id === playerId)!
    victim.character = structuredClone(source.character!); victim.character.items[0]!.id = 2; victim.character.equipment.weapon = 2
    world.nextItemId = 3
    world.content.m2!.itemBases[0]!.modifiers = [{ id: 'heat-reduce', kind: 'reduction', damageType: 'heat', value: .75, requiredTags: [], types: [] }]
    source.health = 0; source.death = { startTick: 1, ageTicks: 0, despawnAfterTicks: null }
    ticks(world, 29)
    victim.action = { id: 'dodge', kind: 'dodge', startTick: 28, ageTicks: 2, direction: 0, hitTargetIds: [], projectileSpawned: false }
    const events = tick(world)
    expect(events.filter(e => e.type === 'damage')).toEqual([expect.objectContaining({ actorId: playerId, amount: 1 })])
    expect(victim.action?.id).toBe('dodge'); expect(victim.impactPauseTicks).toBe(0); expect(victim.knockback).toBeNull()
  })

  it('A19 lethal pulse removes ailments and awards XP/loot exactly once', () => {
    const { world, playerId, victimId } = pulseFixture(); const victim = world.entities.find(e => e.id === victimId)!
    victim.health = 2; victim.kind = 'creaseback'; victim.ai = { enemyId: 'creaseback', phase: 'idle', ageTicks: 0, targetId: null }
    const events = ticks(world, 150)
    expect(events.filter(e => e.type === 'death' && e.targetId === victimId)).toHaveLength(1)
    expect(world.ailments).toHaveLength(0)
    expect(world.entities.find(e => e.id === playerId)!.character!.xp).toBe(20)
    expect(world.encounter!.rewardedIds.filter(id => id === victimId)).toHaveLength(1)
  })
  it('A22 Burden does not scale knockback and world-tick duration advances through hit-stop', () => {
    const { world, player } = fixture(); const victim = target(world, 1000, { x: 100, z: 0 })
    world.tick = 1
    world.ailments = [{ id: 'burden', sourceId: victim.id, targetId: player.id, appliedTick: 1, expiresTick: 91, nextPulseTick: null }]
    player.knockback = { vel: { x: 6, z: 0 }, remainingTicks: 10 }
    ticks(world, 10); expect(player.pos.x).toBeCloseTo(1)
    player.impactPauseTicks = 100
    ticks(world, 80); expect(world.ailments).toEqual([])
  })

  it('A23 due pulses process targets in id order; lethal pulse cancels later ailment work and rewards once', () => {
    const { world, player } = fixture(); world.tick = 1
    const victims = [target(world, 2, { x: 1, z: 0 }), target(world, 2, { x: 1, z: 1 })]
    for (const victim of victims) { victim.kind = 'creaseback'; victim.ai = { enemyId: 'creaseback', phase: 'idle', ageTicks: 0, targetId: null } }
    world.ailments = victims.flatMap(v => [
      { id: 'burden' as const, targetId: v.id, sourceId: player.id, appliedTick: 1, expiresTick: 91, nextPulseTick: null },
      { id: 'draftbind' as const, targetId: v.id, sourceId: player.id, appliedTick: 1, expiresTick: 91, nextPulseTick: null },
      { id: 'emberprint' as const, targetId: v.id, sourceId: player.id, appliedTick: 1, expiresTick: 121, nextPulseTick: 31 }
    ])
    const events = ticks(world, 30)
    expect(events.filter(e => e.type === 'damage').map(e => e.targetId)).toEqual(victims.map(v => v.id))
    expect(events.filter(e => e.type === 'death')).toHaveLength(2)
    expect(world.ailments).toEqual([]); expect(player.character!.xp).toBe(40)
    expect(ticks(world, 150).filter(e => e.type === 'death')).toHaveLength(0)
  })

})
