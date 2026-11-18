import { describe, expect, it } from 'vitest'
import { m1Content } from '../../content/m1'
import { actionSchema, affixSchema, contentSchema, foldSchema, graphProfileSchema, itemBaseSchema, lootTableSchema } from '../../content/schema'
import { buildScenario } from '../scenarios'
import { copyCommand, createWorld, exportCharacter, hashWorld, IDLE_COMMAND, inspectStats, loadCharacter, previewAction, previewBuild, Recorder, restore, rngFloat, serialize, spawnEntity, step, verifyReplay } from './index'
import { EQUIPMENT_ROLES } from './types'
import type { ActionDefinition, CombatContent, FoldDefinition, GraphProfile, ItemBase, LootTable, Operation, StatModifier } from './types'

const operations: Operation[] = [
  { type: 'allocate', nodeId: '1,0' }, { type: 'refund', nodeId: '1,0' },
  { type: 'activateShape', shapeId: 'rhombus-0', active: true },
  { type: 'equip', itemId: 1 }, { type: 'unequip', role: 'offhand' },
  { type: 'setLoadout', slots: ['span-cut', 'fold-dart', null, null, null, null] },
  { type: 'setFolds', skillId: 'fold-dart', foldIds: ['fixture-fold'] },
  { type: 'pickup', itemId: 1 }, { type: 'stash', itemId: 1, from: 'inventory' },
  { type: 'discard', itemId: 1, from: 'stash' }, { type: 'beginEncounter' }, { type: 'returnToShelter' }
]
const zero = { weight: 0, heat: 0, gale: 0 }
const modifier: StatModifier = { id: 'fixture-boost', requiredTags: [], types: [], kind: 'boost', value: 0.05 }
const action: ActionDefinition = { ...m1Content().skills[1]!, name: 'Fixture action', tags: ['cast', 'projectile'], baseDamage: { ...zero, weight: 16 }, weaponCoefficient: 0, reach: 10 }
const fold: FoldDefinition = { id: 'fixture-fold', name: 'Fixture fold', handle: 'reach', tension: 1, compatibility: 'finite-reach',
  modifiers: [], reachFactor: 1.5, arcFactor: 1, radiusFactor: 1, windupDelta: 0, recoveryDelta: 6, projectileAngles: [0] }
const graph: GraphProfile = { id: 'fixture-graph', version: 1, radius: 7,
  families: Array.from({ length: 6 }, (_, index) => ({ id: `family-${index}`, name: 'Fixture family', modifiers: [modifier] })),
  bargains: Array.from({ length: 6 }, (_, orientation) => ({ orientation, rhombus: [modifier], hexagon: [modifier] })) }
const bases: ItemBase[] = EQUIPMENT_ROLES.map(role => ({ id: `fixture-${role}`, name: 'Fixture base', role, starter: true,
  weaponDamage: { ...zero, weight: role === 'weapon' ? 24 : 0 }, modifiers: [] }))
const affix = { id: 'fixture-health', name: 'Fixture health', category: 'utility' as const, roles: ['weapon' as const],
  modifier: { ...modifier, kind: 'health' as const, value: 0 }, valuePerPoint: 1,
  tiers: [{ tier: 1 as const, min: 8, max: 12, unlockRank: 1 }, { tier: 2 as const, min: 13, max: 18, unlockRank: 5 }, { tier: 3 as const, min: 19, max: 26, unlockRank: 10 }] }
const loot: LootTable = { id: 'fixture-loot', dropChance: 0.5, roles: [{ role: 'weapon', weight: 1 }],
  rarities: [{ categories: [], weight: 1 }], tiers: [{ tier: 1, weight: 1, unlockRank: 1 }] }

function content(): CombatContent {
  return contentSchema.parse({ ...m1Content(), m2: { version: 'fixture-v1', actions: [action], folds: [fold], graphProfiles: [graph], itemBases: bases, affixes: [affix], lootTables: [loot] } })
}

function populated() {
  const world = createWorld(7, undefined, content())
  world.tick = 10
  const actor = spawnEntity(world, { kind: 'player', pos: { x: 0, z: 0 }, radius: 0.32 })
  world.nextItemId = 2
  actor.character = { rank: 1, xp: 0, points: 3,
    graph: { profileId: graph.id, seed: 7, version: 1, allocations: ['1,0'], activeShapes: [] },
    items: [{ id: 1, baseId: 'fixture-weapon', role: 'weapon', affixes: [{ familyId: affix.id, category: 'utility', tier: 1, roll: 8 }] }],
    equipment: { weapon: 1, offhand: null, coat: null, boots: null, 'survey-tally': null }, inventory: [], stash: [],
    loadout: ['fold-dart', null, null, null, null, null], folds: { 'fold-dart': [fold.id] } }
  rngFloat(world, 'loot')
  actor.skillCooldowns['fold-dart'] = 2
  world.encounter = { id: 'fixture-clearing', phase: 'rest', attempt: 1, rewardedIds: [] }
  return { world, actor }
}

describe('T2.0 shared contracts', () => {
  it('routes all twelve operations in order, reports unsupported and records rejected edits without changing build/items/RNG', () => {
    const world = createWorld(7)
    const before = structuredClone(world)
    const recorder = new Recorder(world)
    const command = { ...IDLE_COMMAND, operations: structuredClone(operations) }
    const events = step(world, command)
    recorder.record(command)
    expect(events).toEqual(operations.map((operation, index) => ({ type: 'operationRejected', tick: 1, index, operation, reason: 'unsupported' })))
    expect({ ...world, tick: 0 }).toEqual(before)
    command.operations[6] = { type: 'beginEncounter' }
    expect(recorder.exportReplay().commands[0]!.operations).toEqual(operations)
    expect(verifyReplay(recorder.exportReplay())).toEqual({ ok: true })
    expect(step(createWorld(7), IDLE_COMMAND)).toEqual([])
  })

  it.each([
    null, { type: 'unknown' }, { type: 'equip', itemId: 0 }, { type: 'activateShape', shapeId: 'a' },
    { type: 'setLoadout', slots: [null] }, { type: 'setLoadout', slots: Array(6) },
    { type: 'setFolds', skillId: 'fold-dart', foldIds: [1] }, { type: 'stash', itemId: 1, from: 'ground' },
    { type: 'beginEncounter', extra: true }
  ])('rejects malformed operation %j before the tick or an earlier edit', bad => {
    const world = createWorld(7)
    const before = serialize(world)
    const command = { ...IDLE_COMMAND, operations: [operations[0]!, bad] } as Parameters<typeof step>[1]
    expect(() => step(world, command)).toThrow(/Invalid command operation/)
    expect(serialize(world)).toBe(before)
  })

  it('detaches nested operation inputs and events', () => {
    const command = { ...IDLE_COMMAND, operations: structuredClone(operations) }
    const copied = copyCommand(command)
    const events = step(createWorld(7), command)
    const loadout = command.operations.find(operation => operation.type === 'setLoadout')!
    loadout.slots[0] = null
    expect(copied.operations).toEqual(operations)
    expect(events[5]).toMatchObject({ operation: operations[5] })
  })

  it('returns explicit unsupported queries and throws for character projections without mutating state', () => {
    const world = buildScenario('m1-arena', 7)
    const before = serialize(world)
    expect(inspectStats(world, 1)).toEqual({ ok: false, reason: 'unsupported' })
    expect(previewAction(world, 1, 'span-cut', 2)).toEqual({ ok: false, reason: 'unsupported' })
    expect(previewBuild(world, operations[0]!)).toEqual({ ok: false, reason: 'unsupported' })
    expect(() => exportCharacter(world)).toThrow(/Unsupported/)
    expect(() => loadCharacter({}, m1Content())).toThrow(/Unsupported/)
    expect(serialize(world)).toBe(before)
    expect(() => buildScenario('m2-clearing', 7)).toThrow(/Unsupported/)
  })

  it('round trips and hashes populated continuation fields without deriving gameplay', () => {
    const { world } = populated()
    const bytes = serialize(world)
    expect(restore(bytes)).toEqual(world)
    const resumed = restore(bytes)
    resumed.entities[0]!.character!.graph.seed++
    expect(hashWorld(resumed)).not.toBe(hashWorld(world))
    expect(serialize(world)).toBe(bytes)
    expect(() => step(resumed, IDLE_COMMAND)).toThrow(/Unsupported: progression/)
  })

  it('retains captured recipes, fan deduplication and ailment credit after the source action completes', () => {
    const { world, actor } = populated()
    const target = spawnEntity(world, { kind: 'fixture-target', pos: { x: 2, z: 0 }, radius: 0.4 })
    world.actionGroups = [{ id: 'fixture-group', actorId: actor.id, actionStartTick: 1, hitTargetIds: [target.id] }]
    world.ailments = [{ id: 'emberprint', sourceId: actor.id, targetId: target.id, appliedTick: 1, expiresTick: 121, nextPulseTick: 31 }]
    world.projectiles.push({ id: world.nextId++, ownerId: actor.id, faction: actor.faction, skillId: action.id, actionStartTick: 1,
      pos: { x: 1, z: 0 }, vel: { x: 14, z: 0 }, ageTicks: 9, lifetimeTicks: 43, radius: 0.12,
      damage: 16, knockback: { speed: 0, ticks: 0 }, impactPauseTicks: 2, hitFlashTicks: 6, groupId: 'fixture-group',
      recipe: { skillId: action.id, tags: ['cast', 'projectile'], folds: [], sourceDamage: { ...zero, weight: 16 }, modifiers: [],
        timing: action.timing, footprint: { kind: 'projectile', reach: 10, arcRadians: 0, radius: 0.12, speed: 14, lifetimeTicks: 43, projectileAngles: [-18, 0, 18] } } })
    const bytes = serialize(world)
    expect(restore(bytes)).toEqual(world)
    for (const mutate of [
      (resumed: typeof world) => { resumed.projectiles[0]!.recipe!.sourceDamage.weight++ },
      (resumed: typeof world) => { resumed.actionGroups[0]!.hitTargetIds = [] },
      (resumed: typeof world) => { resumed.ailments[0]!.expiresTick++ }
    ]) {
      const resumed = restore(bytes)
      mutate(resumed)
      expect(hashWorld(resumed)).not.toBe(hashWorld(world))
    }
    world.tick = 40
    const captured = structuredClone(world.projectiles[0]!.recipe!)
    captured.timing.recoveryTicks = 35
    actor.action = { id: action.id, kind: 'projectile', startTick: 1, ageTicks: 30, direction: 0, hitTargetIds: [],
      projectileSpawned: true, recipe: captured, groupId: 'fixture-group' }
    world.ailments = []
    expect(restore(serialize(world)).entities[0]!.action!.ageTicks).toBe(30)
  })

  it.each([
    (world: ReturnType<typeof createWorld>) => { world.nextItemId = 1 },
    (world: ReturnType<typeof createWorld>) => { world.entities[0]!.character!.points++ },
    (world: ReturnType<typeof createWorld>) => { world.entities[0]!.character!.inventory.push(1) },
    (world: ReturnType<typeof createWorld>) => { world.entities[0]!.character!.items[0]!.affixes[0]!.roll = 99 },
    (world: ReturnType<typeof createWorld>) => { Reflect.deleteProperty(world, 'ailments') },
    (world: ReturnType<typeof createWorld>) => { world.entities[0]!.skillCooldowns['fold-dart'] = -1 }
  ])('rejects invalid continuation state', mutate => {
    const { world } = populated()
    mutate(world)
    expect(() => restore(serialize(world))).toThrow(/Invalid snapshot/)
  })


})

describe('content schemas before world construction', () => {
  it.each([[actionSchema, action], [foldSchema, fold], [graphProfileSchema, graph], [itemBaseSchema, bases[0]], [affixSchema, affix], [lootTableSchema, loot]] as const)(
    'validates and detaches each public content schema', (schema, input) => {
      expect(schema.parse(input)).toEqual(input)
      expect(schema.parse(input)).not.toBe(input)
      expect(() => schema.parse(null)).toThrow(/Invalid content/)
    })

  it('keeps M1 content valid and validates/detaches content before creating a world', () => {
    expect(contentSchema.parse(m1Content())).toEqual(m1Content())
    const source = content()
    const world = createWorld(7, undefined, source)
    source.m2!.actions[0]!.baseDamage.weight = 999
    expect(world.content.m2!.actions[0]!.baseDamage.weight).toBe(16)
    source.m2!.actions[0]!.baseDamage.weight = -1
    expect(() => createWorld(7, undefined, source)).toThrow(/Invalid content/)
  })

  it.each([
    { ...modifier, kind: 'conversion', from: 'heat', to: 'weight', value: 0.5 },
    { ...modifier, kind: 'conversion', from: 'weight', to: 'heat', value: 1.1 },
    { ...modifier, kind: 'multiplier', value: -1 }
  ])('rejects invalid conversion/factors at construction', modifier => {
    const source = content()
    source.m2!.folds[0]!.modifiers = [modifier as StatModifier]
    expect(() => createWorld(7, undefined, source)).toThrow(/Invalid content/)
  })
})
