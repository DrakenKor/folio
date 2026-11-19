import { expect, it } from 'vitest'
import { exportCharacter, hashWorld, previewAction, previewBuild, restore, serialize } from '../../core'
import type { Loadout } from '../../core'
import { profile } from '../../../../scenarios/m3a-profile'
import { succeeds } from '../m2/fixtures'
import { accepted, arena, buttons, cards, casts, char, clearing, command, families, neutralCard, operate, playerOf, pleats, refit, run, target } from './fixtures'
import type { Family } from './fixtures'

it('D01 versioned clearing starts at rest with exactly ten drawings, six folds and starter bindings', () => {
  const w = clearing()
  expect(w).toMatchObject({ schema: 5, build: 'm3-sim-v1', encounter: { phase: 'rest' } })
  expect(char(w).loadout).toEqual([...families.hemblade, ...casts, null, null])
  expect(profile(w).actions.map(a => a.id).sort()).toEqual(cards.map(c => c[0]).sort())
  expect(profile(w).folds.map(f => f.id).sort()).toEqual(pleats.map(f => f[0] + '-pleat').sort())
  const bytes = serialize(w)
  expect(serialize(restore(bytes))).toBe(bytes)
  const mixed = JSON.parse(bytes)
  mixed.world.build = mixed.build = 'm2-sim-v2'
  expect(() => restore(JSON.stringify(mixed))).toThrow()
})

it.each(cards)('D02 authored %s base, coefficient, immutable tags, phases and measurable geometry', (...row) => {
  const w = clearing(), expected = neutralCard(row), actual = profile(w).actions.find(a => a.id === expected.id)
  expect(actual).toBeDefined()
  expect(actual!.tags.slice().sort()).toEqual(expected.tags.slice().sort())
  expect(actual).toMatchObject({
    baseDamage: expected.baseDamage, weaponCoefficient: expected.weaponCoefficient,
    timing: { windupTicks: expected.timing.windupTicks, recoveryTicks: expected.timing.recoveryTicks }
  })
  if (expected.id !== 'rill-fan') expect(actual!.timing.activeTicks).toBe(expected.timing.activeTicks)
  if (expected.id !== 'gather-line') expect(actual!.reach).toBe(expected.reach)
  if (expected.kind === 'projectile') expect(actual).toMatchObject({ kind: 'projectile', speed: expected.speed, radius: expected.radius })
  if (expected.id === 'span-cut' && actual?.kind === 'melee') expect(actual.arcRadians).toBeCloseTo(100 * Math.PI / 180)
})

it('D03 four equal-weight weapon bases share one pool, only Shortblade starts equipped', () => {
  const w = clearing(), weapons = profile(w).itemBases.filter(b => b.role === 'weapon')
  expect(weapons).toHaveLength(4)
  expect(weapons.filter(b => b.starter).map(b => b.id)).toEqual(['shortblade'])
  for (const weapon of weapons) expect(weapon.weaponDamage).toEqual({ weight: 24, heat: 0, gale: 0 })
  expect(playerOf(w).health).toBe(148)
})

it.each(Object.keys(families) as Family[])('I01 atomic %s refit with 60 full cells preserves rolls, identity, RNG and allocator', family => {
  const w = clearing(), c = char(w), weapon = c.items.find(i => i.id === c.equipment.weapon)!
  weapon.affixes = [{ familyId: 'weapon-weight-flat', category: 'offensive', tier: 1, roll: 5 }]
  for (let i = 0; i < 60; i++) {
    const item = { ...structuredClone(weapon), id: w.nextItemId++ }
    c.items.push(item)
    c[i < 30 ? 'inventory' : 'stash'].push(item.id)
  }
  const before = exportCharacter(w), hash = hashWorld(w), edit = refit(family)
  const preview = succeeds('rest refit preview', () => previewBuild(w, edit))
  expect(hashWorld(w)).toBe(hash)
  expect(preview).toMatchObject({ ok: true, value: { result: { accepted: true } } })
  accepted(w, edit)
  const after = exportCharacter(w), held = after.character.items.find(i => i.id === weapon.id)!
  expect(held.affixes).toEqual(before.character.items.find(i => i.id === weapon.id)!.affixes)
  expect(after.character).toMatchObject({
    inventory: before.character.inventory, stash: before.character.stash, equipment: before.character.equipment,
    loadout: [...families[family], ...casts, null, null]
  })
  expect(after.nextItemId).toBe(before.nextItemId)
  expect(after.lootRng).toEqual(before.lootRng)
  expect(after.character.items.filter(i => i.id !== weapon.id)).toEqual(before.character.items.filter(i => i.id !== weapon.id))
  expect(preview).toMatchObject({ value: { loadout: after.character.loadout } })
})

it('I02 vacated weapon slots precede empty slots; same family keeps bindings and retained folds', () => {
  const w = clearing()
  accepted(w, { type: 'setFolds', skillId: 'span-cut', foldIds: ['after-pleat'] })
  const slots: Loadout = [null, null, 'rill-fan', null, 'span-cut', null]
  accepted(w, { type: 'setLoadout', slots })
  accepted(w, refit('hemblade'))
  expect(char(w).loadout).toEqual(slots)
  accepted(w, refit('hearth-frame'))
  expect(char(w).loadout).toEqual(['lift-print', null, 'rill-fan', null, 'lay-bed', null])
  accepted(w, refit('hemblade'))
  expect(char(w).folds['span-cut']).toEqual(['after-pleat'])
})

it('I03 tally removal clears only casts and does not rebind a deliberately empty slot on equip', () => {
  const w = clearing(), id = char(w).equipment['survey-tally']!
  accepted(w, { type: 'unequip', role: 'survey-tally' })
  expect(char(w).loadout).toEqual([...families.hemblade, null, null, null, null])
  accepted(w, { type: 'equip', itemId: id })
  expect(char(w).loadout).toEqual([...families.hemblade, null, null, null, null])
})

it('I04 combat refit and duplicate bindings reject without changing build, points or RNG', () => {
  const w = clearing(), dup: Loadout = ['span-cut', 'span-cut', null, null, null, null], before = exportCharacter(w)
  expect(operate(w, { type: 'setLoadout', slots: dup })).toMatchObject({ type: 'operationRejected', reason: 'duplicate-skill' })
  expect(exportCharacter(w)).toEqual(before)
  accepted(w, { type: 'beginEncounter' })
  const active = exportCharacter(w)
  expect(operate(w, refit('verge-reel'))).toMatchObject({ type: 'operationRejected', reason: 'requires-rest' })
  expect(exportCharacter(w)).toEqual(active)
})

it.each(cards.map(c => [c[0]] as const))('I05 bind rejection and locked preview name the requirement for %s', id => {
  const w = arena(families.hemblade.some(x => x === id) ? 'plumbshoe' : 'hemblade')
  w.encounter!.phase = 'rest'
  const tally = casts.some(s => s === id)
  if (tally) accepted(w, { type: 'unequip', role: 'survey-tally' })
  const victim = target(w, 1), before = exportCharacter(w), reason = tally ? 'tally-required' : 'wrong-family'
  const edit = { type: 'setLoadout' as const, slots: [id, null, null, null, null, null] as Loadout }
  expect(previewBuild(w, edit)).toMatchObject({ ok: true, value: { result: { accepted: false, reason } } })
  expect(operate(w, edit)).toMatchObject({ type: 'operationRejected', reason })
  expect(exportCharacter(w)).toEqual(before)
  const required = tally ? 'survey-tally' : Object.entries(families).find(([, pair]) => pair.some(s => s === id))![0]
  expect(previewAction(w, playerOf(w).id, id, victim.id)).toMatchObject({ ok: true, value: { lockedReason: reason, requiredItem: required } })
})

it.each(buttons.map((bit, i) => [bit, i] as const))('I06 stale slot bit %i at index %i cannot start a wrong-family or tally cast', (bit, i) => {
  for (const id of ['plinth-blow', 'fold-dart']) {
    const w = arena(), c = char(w), p = playerOf(w)
    target(w, 1)
    if (id === 'fold-dart') {
      c.inventory.push(c.equipment['survey-tally']!)
      c.equipment['survey-tally'] = null
    }
    c.loadout = [null, null, null, null, null, null]
    c.loadout[i] = id
    p.skills = { primary: c.loadout[0], secondary: c.loadout[1] }
    const before = exportCharacter(w), events = run(w, 60, command(bit))
    expect(events.filter(e => e.type === 'action' || e.type === 'damage')).toEqual([])
    expect(p.skillCooldowns[id] ?? 0).toBe(0)
    expect(exportCharacter(w)).toEqual(before)
  }
})

it.each(pleats)('D04 %s handle, tension and exhaustive drawing whitelist', (name, handle, tension, whitelist) => {
  const w = clearing(), id = name + '-pleat'
  expect(profile(w).folds.find(f => f.id === id)).toMatchObject({ id, handle, tension })
  for (const family of Object.keys(families) as Family[]) {
    accepted(w, refit(family))
    for (const skillId of [...families[family], ...casts]) {
      const edit = { type: 'setFolds' as const, skillId, foldIds: [id] }, allowed = whitelist.some(s => s === skillId)
      expect(previewBuild(w, edit)).toMatchObject({ ok: true, value: { result: { accepted: allowed } } })
      const before = exportCharacter(w)
      expect(operate(w, edit)?.type).toBe(allowed ? 'operationAccepted' : 'operationRejected')
      if (!allowed) expect(exportCharacter(w)).toEqual(before)
    }
  }
})

it('D05 two handles within three tension apply; duplicates, incompatible cards and overspending reject atomically', () => {
  const w = clearing()
  for (const [family, skill, folds] of [['hemblade', 'fold-dart', ['through-pleat', 'splay-pleat']], ['hearth-frame', 'lift-print', ['through-pleat', 'catch-pleat']]] as const) {
    accepted(w, refit(family))
    accepted(w, { type: 'setFolds', skillId: skill, foldIds: [...folds] })
    for (const illegal of [[folds[0], folds[0]], ['through-pleat', 'after-pleat'], [...folds, 'after-pleat']]) {
      const before = exportCharacter(w)
      expect(operate(w, { type: 'setFolds', skillId: skill, foldIds: illegal })?.type).toBe('operationRejected')
      expect(exportCharacter(w)).toEqual(before)
    }
  }
})

it('D06 a seeded weapon-role drop samples all four bases uniformly, awards XP and allocates one item', () => {
  const counts = new Map<string, number>()
  for (let seed = 1; seed <= 256; seed++) {
    const w = arena(), table = profile(w).lootTables[0]!
    table.dropChance = 1
    table.roles = [{ role: 'weapon', weight: 1 }]
    table.rarities = [{ categories: [], weight: 1 }]
    w.rng.loot = [...exportCharacter(clearing(seed)).lootRng]
    const victim = target(w, 1, 0, { health: 1, ai: { enemyId: 'creaseback', phase: 'idle', ageTicks: 0, targetId: null } })
    const events = run(w, 8, command(1))
    expect(events.some(e => e.type === 'death' && e.targetId === victim.id)).toBe(true)
    expect(char(w).xp).toBe(20)
    expect(w.groundDrops).toHaveLength(1)
    const base = w.groundDrops[0]!.item.baseId
    counts.set(base, (counts.get(base) ?? 0) + 1)
  }
  expect([...counts.keys()].sort()).toEqual(['shortblade', 'plumbshoe', 'verge-reel', 'hearth-frame'].sort())
  for (const count of counts.values()) {
    expect(count).toBeGreaterThan(35)
    expect(count).toBeLessThan(94)
  }
})

it('D07 two otherwise-compatible neutral cards isolate duplicate-handle and over-tension rejection', () => {
  for (const reason of ['duplicate-handle', 'tension-limit']) {
    const w = arena()
    w.encounter!.phase = 'rest'
    const first = profile(w).folds.find(f => f.id === 'through-pleat')!, second = profile(w).folds.find(f => f.id === 'splay-pleat')!
    if (reason === 'duplicate-handle') second.handle = first.handle
    else second.tension = 2
    const before = exportCharacter(w), edit = { type: 'setFolds' as const, skillId: 'fold-dart', foldIds: [first.id, second.id] }
    expect(operate(w, edit)).toMatchObject({ type: 'operationRejected', reason })
    expect(exportCharacter(w)).toEqual(before)
  }
})

it.each([
  ['plumbshoe', 'plinth-blow', 'burden', 24], ['hearth-frame', 'lift-print', 'emberprint', 16], ['verge-reel', 'gather-line', 'draftbind', 12]
] as const)('D08 %s preview separates unprepared and prepared contacts and describes the conditional payoff', (family, id, ailment, value) => {
  const w = arena(family), v = target(w, 1), before = hashWorld(w)
  const result = previewAction(w, playerOf(w).id, id, v.id)
  const base = family === 'plumbshoe' ? 42 : family === 'hearth-frame' ? 18 : 24
  expect(result).toMatchObject({
    ok: true, value: {
      condition: ailment,
      conditionalDamage: { clean: [base], prepared: family === 'plumbshoe' ? [base] : [base, value] },
      payoff: family === 'plumbshoe' ? { rootTicks: value } : { secondaryDamage: value },
      paths: expect.any(Array)
    }
  })
  if (result.ok) {
    const paths = Reflect.get(result.value, 'paths')
    expect(paths.length).toBeGreaterThan(0)
    paths.length = 0
  }
  expect(hashWorld(w)).toBe(before)
})

it('I07 equipping a dropped head repairs the loadout atomically; an equivalent head retains custom slots', () => {
  const w = arena()
  w.encounter!.phase = 'rest'
  for (const [baseId, same] of [['shortblade', true], ['verge-reel', false]] as const) {
    const c = char(w), item = { ...structuredClone(c.items[0]!), id: w.nextItemId++, baseId }
    c.items.push(item)
    c.inventory.push(item.id)
    if (same) accepted(w, { type: 'setLoadout', slots: [null, null, 'rill-fan', 'span-cut', null, null] })
    const expected = same ? [null, null, 'rill-fan', 'span-cut', null, null] : ['gather-line', null, 'rill-fan', 'cast-loop', null, null]
    const edit = { type: 'equip' as const, itemId: item.id }, before = hashWorld(w)
    expect(previewBuild(w, edit)).toMatchObject({ ok: true, value: { loadout: expected } })
    expect(hashWorld(w)).toBe(before)
    accepted(w, edit)
    expect(char(w).loadout).toEqual(expected)
    expect(char(w).equipment.weapon).toBe(item.id)
  }
})
