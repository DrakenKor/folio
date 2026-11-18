import { describe, expect, it } from 'vitest'
import { IDLE_COMMAND, exportCharacter, hashWorld, inspectStats, loadCharacter, previewBuild, rngFloat, serialize, step } from '../../core'
import type { RolledItem, World } from '../../core'
import { key, legalVertices, neighbours, rotation, route } from './graph-oracle'
import { edit, fixture, hit, neutralContent, preview, succeeds, target, tick, ticks, value } from './fixtures'

function rank21(world: World, allocations: string[] = []) {
  const character = world.entities.find(e => e.id === world.playerId)!.character!
  character.rank = 21; character.points = 24 - allocations.length; character.graph.allocations = allocations
}
function give(world: World, store: 'inventory' | 'stash' | 'ground' = 'inventory', role: RolledItem['role'] = 'weapon') {
  const player = world.entities.find(e => e.id === world.playerId)!
  const item: RolledItem = { id: world.nextItemId++, baseId: `qa-${role}`, role, affixes: [] }
  if (store === 'ground') world.groundDrops.push({ item, pos: { ...player.pos } })
  else { player.character!.items.push(item); player.character![store].push(item.id) }
  return item
}
function enemy(world: World, health = 1) {
  return target(world, health, { x: 1, z: 0 }, { kind: 'creaseback', ai: { enemyId: 'creaseback', phase: 'idle', ageTicks: 0, targetId: null } })
}


describe('M2 graph and build operations', () => {
  it('P01 exactly 151 vertices, six rotations/reflections and all lattice edges via allocation previews', () => {
    const legal = legalVertices(); expect(legal).toHaveLength(151)
    for (const node of legal.filter(id => id !== '0,0')) {
      const [i, j] = node.split(',').map(Number)
      for (let turn = 0; turn < 6; turn++) {
        expect(legal).toContain(key(rotation([i!, j!], turn)))
        expect(legal).toContain(key(rotation([j!, i!], turn)))
      }
      const { world } = fixture(neutralContent(), true)
      const path = route(node); rank21(world, path.slice(0, -1))
      expect(value(previewBuild(world, { type: 'allocate', nodeId: node })).result).toEqual({ accepted: true, reason: 'ok' })
      for (const [dx, dy] of neighbours) {
        const edge = `${i! + dx},${j! + dy}`
        if (!legal.includes(edge) || edge === '0,0' || path.includes(edge)) continue
        rank21(world, path)
        expect(value(previewBuild(world, { type: 'allocate', nodeId: edge })).result).toEqual({ accepted: true, reason: 'ok' })
      }
    }
    for (const nodeId of ['7,0', '7,-1', '6,1', '8,0', '0,8']) {
      const { world } = fixture(neutralContent(), true)
      expect(value(previewBuild(world, { type: 'allocate', nodeId })).result).toMatchObject({ accepted: false, reason: 'unknown-node' })
    }
  })

  it('P02 free root, connectivity, one point per node and stable rejection reasons', () => {
    const { world, player } = fixture(neutralContent(), true)
    expect(player.character!.points).toBe(4)
    edit(world, { type: 'allocate', nodeId: '2,0' }, 'not-connected')
    edit(world, { type: 'allocate', nodeId: '1,0' }); expect(player.character!.points).toBe(3)
    edit(world, { type: 'allocate', nodeId: '1,0' }, 'already-allocated')
    for (const nodeId of ['2,0', '3,0', '4,0']) edit(world, { type: 'allocate', nodeId })
    edit(world, { type: 'allocate', nodeId: '5,0' }, 'insufficient-points')
    expect(player.character!.graph.allocations).not.toContain('0,0')
    expect(player.character!.points).toBe(0)
  })

  it.each(Array.from({ length: 6 }, (_, orientation) => orientation))('P03 marked rhombus and hexagon orientation %i require every perimeter node and explicit activation', orientation => {
    for (const kind of ['rhombus', 'hexagon']) {
      const perimeter = kind === 'rhombus' ? [[1, 0], [1, 1], [0, 1]].map(p => rotation(p, orientation)) :
        neighbours.map(([di, dj]) => rotation([3 + di, dj], orientation))
      const allocations = [...new Set(perimeter.flatMap(p => route(key(p))))]
      const { world, player } = fixture(neutralContent(), true); rank21(world, allocations)
      const victim = target(world)
      const before = preview(world, player, 'span-cut', victim).damage.calculated
      edit(world, { type: 'activateShape', shapeId: `${kind}-${orientation}`, active: true })
      expect(preview(world, player, 'span-cut', victim).damage.calculated).toBeGreaterThan(before)
      edit(world, { type: 'activateShape', shapeId: `${kind}-${orientation}`, active: false })
      expect(preview(world, player, 'span-cut', victim).damage.calculated).toBe(before)
      player.character!.graph.allocations = allocations.filter(node => node !== key(perimeter[0]!)); player.character!.points++
      edit(world, { type: 'activateShape', shapeId: `${kind}-${orientation}`, active: true }, 'incomplete-shape')
    }
  })

  it('P04 two shapes maximum, root-only overlap, inactive/incidental cycles grant no bargain', () => {
    const { world, player } = fixture(neutralContent(), true)
    rank21(world, [...new Set([0, 1, 2, 3].flatMap(n => [[1, 0], [1, 1], [0, 1]].map(p => key(rotation(p, n)))))])
    edit(world, { type: 'activateShape', shapeId: 'rhombus-0', active: true })
    edit(world, { type: 'activateShape', shapeId: 'rhombus-1', active: true }, 'shape-overlap')
    edit(world, { type: 'activateShape', shapeId: 'rhombus-3', active: true })
    edit(world, { type: 'activateShape', shapeId: 'rhombus-2', active: true }, 'shape-limit')
    expect(player.character!.graph.activeShapes).toHaveLength(2)
    edit(world, { type: 'activateShape', shapeId: 'unmarked-cycle', active: true }, 'unknown-shape')
  })

  it('P05 cascading refund previews and applies atomically, refunds every point and breaks shapes', () => {
    const { world, player } = fixture(neutralContent(), true)
    rank21(world, ['1,0', '2,0', '3,-1', '3,1', '4,0', '4,-1', '2,1'])
    edit(world, { type: 'activateShape', shapeId: 'hexagon-0', active: true })
    const before = serialize(world)
    const shown = value(previewBuild(world, { type: 'refund', nodeId: '1,0' }))
    expect(shown.refundedNodeIds.slice().sort()).toEqual(player.character!.graph.allocations.slice().sort())
    expect(shown.deactivatedShapeIds).toEqual(['hexagon-0'])
    expect(shown.delta.points).toBe(7); expect(serialize(world)).toBe(before)
    edit(world, { type: 'refund', nodeId: '1,0' })
    expect(player.character!.graph).toMatchObject({ allocations: [], activeShapes: [] }); expect(player.character!.points).toBe(24)
  })

  it('P06 seeded families stable across reload; base counted once; rest-only build edits', () => {
    const { world, player } = fixture(neutralContent(), true)
    edit(world, { type: 'allocate', nodeId: '1,0' })
    const first = value(inspectStats(world, player.id))
    const loaded = succeeds('loadCharacter', () => loadCharacter(exportCharacter(world), world.content)).world
    expect(value(inspectStats(loaded, loaded.playerId!))).toEqual(first)
    edit(world, { type: 'beginEncounter' })
    const before = structuredClone({ character: player.character, rng: world.rng })
    for (const operation of [{ type: 'allocate', nodeId: '0,1' }, { type: 'refund', nodeId: '1,0' }, { type: 'unequip', role: 'offhand' }] as const) edit(world, operation, 'requires-rest')
    expect({ character: player.character, rng: world.rng }).toEqual(before)
  })

  it('P07 ordered atomic operations before actions; malformed command cannot partly apply', () => {
    const { world, player } = fixture(neutralContent(), true)
    const before = serialize(world)
    expect(() => step(world, { ...IDLE_COMMAND, operations: [{ type: 'allocate', nodeId: '1,0' }, { type: 'equip', itemId: -1 }] })).toThrow(/Invalid command/)
    expect(serialize(world)).toBe(before)
    const events = tick(world, { ...IDLE_COMMAND, operations: [{ type: 'allocate', nodeId: '1,0' }, { type: 'allocate', nodeId: '2,0' }] })
    expect(events.filter(e => e.type === 'operationAccepted').map(e => e.index)).toEqual([0, 1])
    expect(player.character!.graph.allocations).toEqual(['1,0', '2,0'])
  })
  it('P21 graph seed selects a reproducible sector-family permutation; axis ties assign one family only', () => {
    const permutations = new Set<string>()
    for (let seed = 7; seed < 17; seed++) {
      const families: string[] = []
      for (const [i, j] of neighbours) {
        const content = neutralContent()
        const descriptors = [
          { kind: 'boost', value: .05, types: ['weight'], requiredTags: [] },
          { kind: 'boost', value: .05, types: ['heat'], requiredTags: [] },
          { kind: 'boost', value: .05, types: ['gale'], requiredTags: [] },
          { kind: 'boost', value: .05, types: [], requiredTags: ['melee'] },
          { kind: 'boost', value: .05, types: [], requiredTags: ['cast'] },
          { kind: 'health', value: 4, types: [], requiredTags: [] }
        ]
        content.m2!.graphProfiles[0]!.families.forEach((family, index) => { family.modifiers = [{ id: `sector-${index}`, ...descriptors[index]! } as typeof family.modifiers[number]] })
        const { world, player } = fixture(content, true); player.character!.graph.seed = seed
        const before = value(inspectStats(world, player.id))
        edit(world, { type: 'allocate', nodeId: `${i},${j}` })
        const after = value(inspectStats(world, player.id))
        const added = after.sources.filter(source => !before.sources.some(old => old.id === source.id)).flatMap(source => source.modifiers)
        expect(added).toHaveLength(1)
        const m = added[0]!; families.push(JSON.stringify([m.kind, m.value, m.types, m.requiredTags]))
      }
      expect(new Set(families).size).toBe(6); permutations.add(families.join('|'))
    }
    expect(permutations.size).toBeGreaterThan(1)
  })

})

describe('M2 items, XP, loot and clearing', () => {
  it('P08 rank costs 60*rank, carries surplus, points only, 20 XP per deduped Creaseback death', () => {
    const { world, player } = fixture(); player.character!.xp = 50
    const victim = enemy(world); hit(world, player, victim); ticks(world, 90)
    expect(player.character).toMatchObject({ rank: 2, xp: 10, points: 5 })
    expect(player.maxHealth).toBe(120)
    expect(world.encounter!.rewardedIds.filter(id => id === victim.id)).toHaveLength(1)
  })

  it('P09 rank 21 caps at 24 paid points, discards XP; player death loses no earned progress', () => {
    const { world, player } = fixture(); rank21(world)
    hit(world, player, enemy(world)); expect(player.character).toMatchObject({ rank: 21, xp: 0, points: 24 })
    const before = structuredClone(player.character)
    player.health = 0; player.death = { startTick: world.tick, ageTicks: 0, despawnAfterTicks: null }
    ticks(world, 2); edit(world, { type: 'returnToShelter' })
    expect(player.character).toEqual(before); expect(player.health).toBe(player.maxHealth)
  })

  it('P10 five starter bases count once, casts exclude weapon, health rounds once and movement caps at 30%', () => {
    const content = neutralContent()
    content.m2!.itemBases.find(b => b.role === 'offhand')!.modifiers = [{ id: 'shield-health', kind: 'health', value: 8, types: [], requiredTags: [] }, { id: 'shield-reduce', kind: 'reduction', damageType: 'weight', value: .05, types: [], requiredTags: [] }]
    content.m2!.itemBases.find(b => b.role === 'coat')!.modifiers = [{ id: 'coat-health', kind: 'health', value: 20, types: [], requiredTags: [] }]
    content.m2!.itemBases.find(b => b.role === 'boots')!.modifiers = [{ id: 'boots-speed', kind: 'movement', value: .5, types: [], requiredTags: [] }]
    content.m2!.itemBases.find(b => b.role === 'survey-tally')!.modifiers = [{ id: 'cast-flat', kind: 'flat', damageType: 'weight', value: 2, types: [], requiredTags: ['cast'] }]
    const { world, player } = fixture(content, true)
    for (const role of ['offhand', 'coat', 'boots', 'survey-tally'] as const) edit(world, { type: 'equip', itemId: give(world, 'inventory', role).id })
    const stats = value(inspectStats(world, player.id)); expect(stats.maxHealth).toBe(148); expect(player.health).toBe(148)
    expect(stats.movementSpeed).toBeCloseTo(2.521 * 1.3); expect(stats.reductions.weight).toBe(.05)
    const victim = target(world); expect(preview(world, player, 'fold-dart', victim).damage.calculated).toBe(18)
    expect(preview(world, player, 'span-cut', victim).damage.calculated).toBe(24)
  })

  it('P11 full stores reject pickup/unequip/stash atomically; weapon remains required', () => {
    const { world, player } = fixture(neutralContent(), true)
    const offhand = give(world, 'inventory', 'offhand'); edit(world, { type: 'equip', itemId: offhand.id })
    while (player.character!.inventory.length < 30) give(world)
    while (player.character!.stash.length < 30) give(world, 'stash')
    const drop = give(world, 'ground'); const before = structuredClone({ character: player.character, drops: world.groundDrops, rng: world.rng })
    edit(world, { type: 'pickup', itemId: drop.id }, 'inventory-full')
    edit(world, { type: 'unequip', role: 'offhand' }, 'inventory-full')
    edit(world, { type: 'equip', itemId: player.character!.stash[0]! }, 'inventory-full')
    edit(world, { type: 'unequip', role: 'weapon' }, 'weapon-required')
    edit(world, { type: 'stash', itemId: player.character!.inventory[0]!, from: 'inventory' }, 'stash-full')
    expect({ character: player.character, drops: world.groundDrops, rng: world.rng }).toEqual(before)
  })

  it('P12 fill both stores, discard, collect upgrade, swap equip and persist the result', () => {
    const { world, player } = fixture(neutralContent(), true)
    while (player.character!.inventory.length < 30) give(world)
    while (player.character!.stash.length < 30) give(world, 'stash')
    const drop = give(world, 'ground'); drop.affixes = [{ familyId: 'qa-flat', category: 'offensive', tier: 1, roll: 6 }]
    edit(world, { type: 'discard', itemId: player.character!.inventory[0]!, from: 'inventory' })
    edit(world, { type: 'discard', itemId: player.character!.stash[0]!, from: 'stash' })
    edit(world, { type: 'pickup', itemId: drop.id }); edit(world, { type: 'equip', itemId: drop.id })
    expect(player.character!.equipment.weapon).toBe(drop.id); expect(player.character!.inventory).toContain(1)
    const saved = succeeds('populated projection', () => exportCharacter(world))
    const loaded = succeeds('populated load', () => loadCharacter(saved, world.content)).world
    expect(loaded.entities.find(e => e.id === loaded.playerId)!.character).toEqual(player.character)
    expect(loaded.groundDrops).toEqual([])
  })

  it('P13 pickup live within 1.5m; F nearest and id tie-break; discard requires rest', () => {
    const { world, player } = fixture(neutralContent(), true)
    const first = give(world, 'ground'); const second = give(world, 'ground')
    world.groundDrops[0]!.pos = { x: 1.5, z: 0 }; world.groundDrops[1]!.pos = { x: -1.5, z: 0 }
    tick(world, { ...IDLE_COMMAND, buttons: 128 }); expect(player.character!.inventory).toContain(first.id)
    world.groundDrops.find(d => d.item.id === second.id)!.pos = { x: 1.5001, z: 0 }
    edit(world, { type: 'pickup', itemId: second.id }, 'out-of-range')
    edit(world, { type: 'beginEncounter' }); edit(world, { type: 'discard', itemId: first.id, from: 'inventory' }, 'requires-rest')
  })

  it.each([1, 5, 10])('P14 loot at rank %i respects role/category/tier unlocks, inclusive ranges, eight-affix cap', rank => {
    const content = neutralContent(); content.m2!.lootTables[0]!.dropChance = 1
    const { world, player } = fixture(content); player.character!.rank = rank; player.character!.points = rank + 3
    const tiers = new Set<number>(); const roles = new Set<string>(); const rolls = new Set<number>()
    for (let n = 0; n < 160; n++) {
      hit(world, player, enemy(world)); ticks(world, 30)
      for (const drop of world.groundDrops) {
        const item = drop.item; roles.add(item.role)
        expect(item.affixes.length).toBeLessThanOrEqual(item.role === 'offhand' || item.role === 'boots' ? 1 : 2)
        expect(new Set(item.affixes.map(a => a.category)).size).toBe(item.affixes.length)
        for (const affix of item.affixes) {
          const family = content.m2!.affixes.find(f => f.id === affix.familyId)!
          const tier = family.tiers.find(t => t.tier === affix.tier)!
          expect(family.roles).toContain(item.role); expect(tier.unlockRank).toBeLessThanOrEqual(rank)
          expect(affix.roll).toBeGreaterThanOrEqual(tier.min); expect(affix.roll).toBeLessThanOrEqual(tier.max)
          tiers.add(affix.tier); rolls.add(affix.roll)
        }
      }
      world.groundDrops = []
    }
    expect(roles.size).toBe(5); expect(tiers).toEqual(new Set(rank < 5 ? [1] : rank < 10 ? [1, 2] : [1, 2, 3]))
    expect(rolls).toContain(8); expect(rolls).toContain(12)
  })

  it('P15 ground cap 60 suppresses entire loot roll without consuming RNG; non-loot streams independent', () => {
    const { world, player } = fixture()
    for (let n = 0; n < 60; n++) give(world, 'ground')
    const before = structuredClone(world.rng.loot)
    rngFloat(world, 'presentation-fixture')
    hit(world, player, enemy(world))
    expect(world.groundDrops).toHaveLength(60); expect(world.rng.loot).toEqual(before)
  })

  it('P16 loot RNG and item allocator continue across save/load without repeated-seed rerolls', () => {
    const { world, player } = fixture(); hit(world, player, enemy(world)); ticks(world, 30)
    const data = succeeds('exportCharacter', () => exportCharacter(world))
    const loaded = succeeds('loadCharacter', () => loadCharacter(data, world.content)).world
    expect(loaded.rng.loot).toEqual(world.rng.loot); expect(loaded.nextItemId).toBe(world.nextItemId)
    world.groundDrops = []; loaded.groundDrops = []
    for (const candidate of [world, loaded]) {
      candidate.encounter!.phase = 'active'
      const actor = candidate.entities.find(e => e.id === candidate.playerId)!
      hit(candidate, actor, enemy(candidate))
    }
    expect(loaded.groundDrops.map(d => d.item)).toEqual(world.groundDrops.map(d => d.item))
    expect(loaded.rng.loot).toEqual(world.rng.loot)
  })

  it.each([false, true])('P17 final kill rest loot survives, including whole-trio sector kill=%s; next Start clears', simultaneous => {
    const content = neutralContent(); content.m2!.lootTables[0]!.dropChance = 1
    const { world, player } = fixture(content); world.scenario = 'm2-clearing'; world.encounter!.id = 'm2-clearing'
    const victims = Array.from({ length: simultaneous ? 3 : 1 }, () => enemy(world))
    hit(world, player, victims[0]!); ticks(world, 30)
    expect(victims.every(v => v.health === 0)).toBe(true); expect(world.encounter!.phase).toBe('rest')
    expect(world.groundDrops).toHaveLength(victims.length)
    edit(world, { type: 'pickup', itemId: world.groundDrops[0]!.item.id }); expect(player.character!.inventory).toHaveLength(1)
    edit(world, { type: 'beginEncounter' }); expect(world.groundDrops).toEqual([])
    expect(world.encounter!.phase).toBe('active'); expect(world.entities.filter(e => e.faction === 'enemy' && e.health > 0)).toHaveLength(3)
  })

  it('P18 entering rest heals/clears combat/releases input; Start suppresses held attacks; no healing in attempt', () => {
    const { world, player } = fixture(neutralContent(), true); player.health = 20
    const events = tick(world, { ...IDLE_COMMAND, buttons: 3, operations: [{ type: 'beginEncounter' }] })
    expect(events.filter(e => e.type === 'action' && e.id === player.id)).toHaveLength(0)
    expect(player.health).toBe(20); expect(player.previousButtons).toBe(0)
    player.health = 0; player.death = { startTick: world.tick, ageTicks: 0, despawnAfterTicks: null }
    tick(world); edit(world, { type: 'returnToShelter' })
    expect(player.health).toBe(player.maxHealth); expect(player.action).toBeNull(); expect(player.previousButtons).toBe(0)
    expect(world.projectiles).toEqual([]); expect(world.ailments).toEqual([])
  })

  it('P19 invalid character identities, budgets, roles, duplicate placements and tier rolls reject atomically', () => {
    const { world } = fixture(); const data = succeeds('exportCharacter', () => exportCharacter(world))
    for (const change of [
      (d: typeof data) => { d.character.points++ },
      (d: typeof data) => { d.character.equipment.weapon = null },
      (d: typeof data) => { d.character.inventory.push(1) },
      (d: typeof data) => { d.character.items[0]!.role = 'boots' },
      (d: typeof data) => { d.nextItemId = 1 },
      (d: typeof data) => { d.character.items[0]!.affixes = [{ familyId: 'qa-flat', category: 'offensive', tier: 1, roll: 999 }] }
    ]) {
      const bad = structuredClone(data); change(bad); const before = hashWorld(world)
      expect(() => loadCharacter(bad, world.content)).toThrow(); expect(hashWorld(world)).toBe(before)
    }
  })
  it('P20 health rounds once, movement caps, recovery/cooldown floor one; dodge active/immunity/distance unchanged', () => {
    const content = neutralContent()
    content.m2!.itemBases.find(b => b.role === 'weapon')!.modifiers = [{ id: 'fraction-health-a', kind: 'health', value: .4, types: [], requiredTags: [] }, { id: 'weapon-fast', kind: 'recovery', value: -100, types: [], requiredTags: [] }]
    content.m2!.itemBases.find(b => b.role === 'offhand')!.modifiers = [{ id: 'fraction-health-b', kind: 'health', value: .4, types: [], requiredTags: [] }, { id: 'shield-fast', kind: 'dodgeRecovery', value: -100, types: [], requiredTags: [] }]
    content.m2!.itemBases.find(b => b.role === 'boots')!.modifiers = [{ id: 'boots-fast', kind: 'dodgeCooldown', value: -100, types: [], requiredTags: [] }]
    const { world, player } = fixture(content, true)
    for (const role of ['offhand', 'boots'] as const) edit(world, { type: 'equip', itemId: give(world, 'inventory', role).id })
    const stats = value(inspectStats(world, player.id))
    expect(stats.maxHealth).toBe(121); expect(player.health).toBe(121)
    expect(stats.dodge).toMatchObject({ distance: 3, cooldownTicks: 1, invulnerableFrom: 2, invulnerableUntil: 8,
      timing: { activeTicks: 10, recoveryTicks: 1 } })
    const victim = target(world)
    expect(preview(world, player, 'span-cut', victim).recipe.timing).toMatchObject({ windupTicks: 6, activeTicks: 3, recoveryTicks: 1, moveCancelTicks: 1 })
  })

})
