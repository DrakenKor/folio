import { expect, it } from 'vitest'
import legacy from '../../../../scenarios/m3a-save-v1.json'
import { canonical, exportCharacter, loadCharacter, SAVE_MAX_BYTES } from '../../core'
import type { CharacterData } from '../../core'
import { buildScenario } from '../../scenarios'
import { profile } from '../../../../scenarios/m3a-profile'
import { succeeds } from '../m2/fixtures'
import { accepted, char, clearing, families, playerOf, refit } from './fixtures'
import type { Family } from './fixtures'

function projection(): CharacterData {
  const { format: _format, schema: _schema, generation: _generation, build: _build, ...data } = structuredClone(legacy)
  return data as unknown as CharacterData
}
function migrate(input = projection()) {
  return succeeds('direct migration to the current player profile', () => loadCharacter(input, clearing().content))
}
it('S01 frozen schema-1 envelope is a legal M2 character with paid shape, full stash/inventory and empty tally', () => {
  expect(legacy).toMatchObject({ schema: 1, format: 'folio.arpg.save', generation: 7 })
  const before = projection(), loaded = loadCharacter(before, buildScenario('m2-clearing', 7).content)
  expect(loaded.refunds).toEqual([])
  expect(exportCharacter(loaded.world)).toEqual(before)
  expect(before.character.graph.allocations).toHaveLength(8)
  expect(before.character.graph.activeShapes).toEqual(['rhombus-0'])
  expect(before.character).toMatchObject({ rank: 5, xp: 23, points: 0, equipment: { 'survey-tally': null } })
  expect(before.character.inventory).toHaveLength(30)
  expect(before.character.stash).toHaveLength(30)
})

it('S02 migration preserves items, rolls, stores, budget, empty tally, RNG and allocator through all four refits', () => {
  const input = projection(), before = canonical(input), loaded = migrate(input), out = exportCharacter(loaded.world)
  expect(canonical(input)).toBe(before)
  expect(out).toMatchObject({ contentVersion: 'm3-v1', seed: input.seed, nextItemId: input.nextItemId, lootRng: input.lootRng })
  const c = out.character
  expect(c).toMatchObject({
    rank: 5, xp: 23, points: 0, graph: input.character.graph, inventory: input.character.inventory,
    stash: input.character.stash, equipment: input.character.equipment, items: input.character.items,
    loadout: ['span-cut', 'open-hem', null, null, null, null]
  })
  for (const family of Object.keys(families) as Family[]) {
    accepted(loaded.world, refit(family))
    expect(char(loaded.world).loadout).toEqual([...families[family], null, null, null, null])
    expect(loaded.world.nextItemId).toBe(input.nextItemId)
  }
})

it('S03 migration itemises every retired, gated and folded drawing once; second load has no receipt', () => {
  const first = migrate(), c = char(first.world)
  expect(c.folds['fold-dart']).toEqual(['splay-pleat'])
  expect(c.folds['hearth-shard']).toBeUndefined()
  const receipt = first.refunds.join('\n').toLowerCase()
  for (const name of [...legacy.character.loadout, 'long-pleat', 'hush-pleat']) expect(receipt).toContain(name)
  expect(new Set(first.refunds).size).toBe(first.refunds.length)
  const data = exportCharacter(first.world), second = migrate(data)
  expect(second.refunds).toEqual([])
  expect(exportCharacter(second.world)).toEqual(data)
  expect(c.points).toBe(0)
})

it('S04 eligible same-id bindings stay in place; retired slots fill family then tally without duplicates', () => {
  const input = projection(), c = input.character
  const tally = c.items.find(i => i.role === 'survey-tally')!
  c.stash = c.stash.filter(id => id !== tally.id)
  c.equipment['survey-tally'] = tally.id
  c.loadout = ['sill-rake', null, 'fold-dart', 'span-cut', 'plinth-blow', 'skim-needle']
  const loaded = migrate(input), slots = char(loaded.world).loadout
  expect(slots).toEqual(['open-hem', 'rill-fan', 'fold-dart', 'span-cut', null, null])
  expect(loaded.refunds.join(' ').toLowerCase()).toMatch(/plinth-blow/)
})

it('S05 changed graph and missing base/affix yield named one-time refunds before destination stamping', () => {
  const input = projection(), g = input.character.graph
  g.allocations[g.allocations.indexOf('1,1')] = '99,99'
  const weapon = input.character.items.find(i => i.id === input.character.equipment.weapon)!
  weapon.baseId = 'retired-base'
  weapon.affixes[0]!.familyId = 'retired-roll'
  const first = migrate(input), c = char(first.world)
  expect(c.points).toBe(1)
  expect(c.graph.activeShapes).toEqual([])
  expect(c.graph.allocations).not.toContain('99,99')
  const replacement = c.items.find(i => i.id === weapon.id)!
  expect(replacement).toMatchObject({ role: 'weapon', baseId: 'shortblade' })
  expect(replacement.affixes[0]!.tier).toBe(1)
  const receipt = first.refunds.join(' ')
  for (const id of ['99,99', 'rhombus-0', 'retired-base', 'retired-roll']) expect(receipt).toContain(id)
  expect(migrate(exportCharacter(first.world)).refunds).toEqual([])
})

it('S06 native save projects empty hub progress, restores healed at rest and excludes running combat', () => {
  const w = clearing(), rested = exportCharacter(w)
  expect(rested).toMatchObject({ contentVersion: 'm3-v1', progress: { lastSafeMarker: 'hem-rest', repairs: [], creditedSockets: [], uncollectedDrops: [] } })
  accepted(w, { type: 'beginEncounter' })
  const p = playerOf(w)
  p.health = 1
  const data = exportCharacter(w), again = migrate(data)
  expect(again.refunds).toEqual([])
  expect(exportCharacter(again.world)).toEqual(rested)
  expect(again.world.encounter?.phase).toBe('rest')
  expect(playerOf(again.world).health).toBe(playerOf(again.world).maxHealth)
  expect(again.world.entities.filter(e => e.ai)).toEqual([])
  expect(again.world.ailments).toEqual([])
  expect(again.world.projectiles).toEqual([])
  expect(canonical(data)).not.toMatch(/"impactPauseTicks"|"projectiles"|"navFields"|"effects"/)
})

it.each(['duplicate ownership', 'bad point budget', 'invalid tier', 'negative retired roll', 'unknown progress', 'future content'] as const)('S07 invalid source %s is rejected before replacement', kind => {
  const data = projection()
  if (kind === 'duplicate ownership') data.character.inventory.push(data.character.equipment.weapon!)
  if (kind === 'bad point budget') data.character.points++
  if (kind === 'invalid tier') data.character.items.find(i => i.role === 'weapon')!.affixes[0]!.roll = 10000
  if (kind === 'negative retired roll') Object.assign(data.character.items.find(i => i.role === 'weapon')!.affixes[0]!, { familyId: 'retired-roll', roll: -1 })
  if (kind === 'future content') data.contentVersion = 'm3-v999'
  if (kind === 'unknown progress') Object.assign(data, { contentVersion: 'm3-v1', progress: { lastSafeMarker: 'unearned', repairs: [], creditedSockets: [], uncollectedDrops: [] } })
  const bytes = canonical(data), content = clearing().content
  expect(() => loadCharacter(data, content)).toThrow()
  expect(canonical(data)).toBe(bytes)
})

it('S08 maximum M3a ownership projection fits both size limits and survives native round trip', () => {
  const w = clearing(), p = playerOf(w), c = char(w), weapon = c.items.find(i => i.id === c.equipment.weapon)!
  c.rank = 21
  c.xp = 0
  c.points = 24
  for (const item of c.items) {
    const pool = profile(w).affixes.filter(f => f.roles.includes(item.role))
    for (const category of ['offensive', 'utility'] as const) {
      const family = pool.find(f => f.category === category)
      if (family) {
        const tier = family.tiers.find(t => t.tier === 3)!
        item.affixes.push({ familyId: family.id, tier: 3, roll: tier.max, category })
      }
    }
  }
  for (let i = 0; i < 60; i++) {
    const item = { ...structuredClone(weapon), id: w.nextItemId++ }
    c[i < 30 ? 'inventory' : 'stash'].push(item.id)
    c.items.push(item)
  }
  expect(p.character!.items).toHaveLength(65)
  const data = exportCharacter(w), text = canonical({ ...data, format: legacy.format, schema: 2, generation: 9, build: w.build })
  expect(new TextEncoder().encode(text).length).toBeLessThanOrEqual(SAVE_MAX_BYTES)
  expect(text.length * 2).toBeLessThanOrEqual(SAVE_MAX_BYTES)
  expect(data.contentVersion).toBe('m3-v1')
  expect(exportCharacter(migrate(data).world)).toEqual(data)
})

const retiredApplications = [
  ['long-pleat', 'fold-dart'], ['short-pleat', 'fold-dart'], ['stanch-pleat', 'span-cut'], ['close-pleat', 'span-cut'],
  ['broad-pleat', 'rill-fan'], ['fine-pleat', 'fold-dart'], ['kiln-pleat', 'fold-dart'], ['vane-pleat', 'fold-dart'],
  ['draft-pleat', 'hearth-shard'], ['ballast-pleat', 'span-cut'], ['hush-pleat', 'skim-needle']
] as const
it.each(retiredApplications)('S09 retired %s on %s is named in the receipt and releases tension exactly once', (fold, skill) => {
  const input = projection()
  input.character.folds = { [skill]: [fold] }
  const baseline = loadCharacter(input, buildScenario('m2-clearing', 7).content)
  expect(baseline.refunds).toEqual([])
  const first = migrate(input), out = exportCharacter(first.world)
  expect(first.refunds.filter(line => line.includes(fold))).toHaveLength(1)
  expect(Object.values(out.character.folds).flat()).not.toContain(fold)
  expect(out.character.points).toBe(input.character.points)
  expect(migrate(out).refunds).toEqual([])
})

it('S10 refund each disconnected paid node once and keep the still-complete root shape', () => {
  const input = projection(), graph = input.character.graph
  graph.allocations[graph.allocations.indexOf('2,0')] = '99,99'
  const loaded = migrate(input), c = char(loaded.world)
  expect(c.points).toBe(5)
  expect(c.graph.activeShapes).toEqual(['rhombus-0'])
  for (const id of ['99,99', '3,0', '4,0', '5,0', '6,0']) expect(loaded.refunds.some(line => line.includes(id))).toBe(true)
  expect(c.graph.allocations).toEqual(['1,0', '1,1', '0,1'])
  expect(migrate(exportCharacter(loaded.world)).refunds).toEqual([])
})
