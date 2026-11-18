import { describe, expect, it } from 'vitest'
import { Button, IDLE_COMMAND, Recorder, hashWorld, inspectStats, previewAction, restore, serialize, verifyReplay } from '../../core'
import type { Command, World } from '../../core'
import { edit, fixture, hit, neutralContent, succeeds, target, tick, ticks, value } from './fixtures'

function paired(world: World, commands: Command[]) {
  const resumed = succeeds('snapshot restore', () => restore(serialize(world)))
  const recorder = new Recorder(world)
  for (const command of commands) {
    const events = tick(world, command); recorder.record(command)
    expect(tick(resumed, command)).toEqual(events)
    if (world.tick % 60 === 0) expect(hashWorld(resumed)).toBe(hashWorld(world))
  }
  expect(hashWorld(resumed)).toBe(hashWorld(world))
  const replay = recorder.exportReplay()
  expect(succeeds('verifyReplay', () => verifyReplay(replay))).toEqual({ ok: true })
  expect(hashWorld(resumed)).toBe(replay.hashes.at(-1)![1])
  return replay
}
const idle = (count: number) => Array.from({ length: count }, () => structuredClone(IDLE_COMMAND))

describe('M2 exact continuation and replay contract', () => {
  it.each(['weight', 'heat', 'gale'] as const)('R01 snapshot during %s ailment retains expiry/pulse/source; equal continuation through operations and loot', type => {
    const content = neutralContent(); content.m2!.itemBases[0]!.weaponDamage = { weight: 0, heat: 0, gale: 0, [type]: 12 }; content.m2!.lootTables[0]!.dropChance = 1
    const { world, player } = fixture(content); world.scenario = 'm2-clearing'; world.encounter!.id = 'm2-clearing'
    const victim = target(world, 25, { x: 1, z: 0 }, { kind: 'creaseback', ai: { enemyId: 'creaseback', phase: 'idle', ageTicks: 0, targetId: null } })
    player.character!.items.push({ id: 2, baseId: 'qa-weapon', role: 'weapon', affixes: [] }); player.character!.inventory = [2]; world.nextItemId = 3
    hit(world, player, victim)
    expect(world.ailments).toHaveLength(1)
    const snapshot = serialize(world); expect(serialize(restore(snapshot))).toBe(snapshot)
    const commands: Command[] = [...idle(150), ...Array.from({ length: 100 }, () => ({ ...IDLE_COMMAND, buttons: Button.Primary, aim: victim.pos })), ...idle(60),
      { ...IDLE_COMMAND, operations: [{ type: 'allocate', nodeId: '1,0' }, { type: 'equip', itemId: 2 }] }, ...idle(5500)]
    paired(world, commands)
    expect(player.character!.xp).toBe(20); expect(player.character!.equipment.weapon).toBe(2); expect(world.groundDrops.length).toBeGreaterThan(0)
  }, 20000)

  it('R02 multi-dart flight persists captured recipe and group hit list after action completes', () => {
    const content = neutralContent(); content.m2!.lootTables[0]!.dropChance = 1
    const { world, player } = fixture(content); world.scenario = 'm2-clearing'; world.encounter!.id = 'm2-clearing'
    player.character!.folds['fold-dart'] = ['long-pleat', 'splay-pleat']
    player.character!.items.push({ id: 2, baseId: 'qa-weapon', role: 'weapon', affixes: [] }); player.character!.inventory = [2]; world.nextItemId = 3
    target(world, 6, { x: 12, z: 0 }, { kind: 'creaseback', ai: { enemyId: 'creaseback', phase: 'idle', ageTicks: 0, targetId: null } })
    tick(world, { ...IDLE_COMMAND, buttons: Button.Secondary, aim: { x: 15, z: 0 } }); ticks(world, 35)
    expect(player.action).toBeNull(); expect(world.projectiles.length).toBeGreaterThan(0); expect(world.actionGroups).toHaveLength(1)
    paired(world, [...idle(100), { ...IDLE_COMMAND, operations: [{ type: 'allocate', nodeId: '1,0' }, { type: 'equip', itemId: 2 }] }, ...idle(5500)])
    expect(player.character!.xp).toBe(20); expect(world.groundDrops).toHaveLength(1)
  }, 20000)

  it('R03 allocation/equipment/loadout/fold edits and rejected semantic edits are copied and replayed in order', () => {
    const { world, player } = fixture(neutralContent(), true)
    player.character!.items.push({ id: 2, baseId: 'qa-weapon', role: 'weapon', affixes: [{ familyId: 'qa-flat', category: 'offensive', tier: 1, roll: 6 }] })
    player.character!.inventory = [2]; world.nextItemId = 3
    const commands: Command[] = [
      { ...IDLE_COMMAND, operations: [{ type: 'allocate', nodeId: '1,0' }, { type: 'allocate', nodeId: '2,0' }] },
      { ...IDLE_COMMAND, operations: [{ type: 'equip', itemId: 2 }] },
      { ...IDLE_COMMAND, operations: [{ type: 'setLoadout', slots: ['fold-dart', 'span-cut', null, null, null, null] }, { type: 'setFolds', skillId: 'fold-dart', foldIds: ['long-pleat', 'splay-pleat'] }] },
      { ...IDLE_COMMAND, operations: [{ type: 'allocate', nodeId: '7,0' }] }, ...idle(75)
    ]
    const replay = paired(world, commands)
    expect(replay.commands).toEqual(commands)
    commands[0]!.operations![0] = { type: 'refund', nodeId: '1,0' }
    expect(replay.commands[0]!.operations![0]).toEqual({ type: 'allocate', nodeId: '1,0' })
  })

  it('R04 7200 ticks rotate recorder, keep >=60 seconds and all build/loot continuation hashes', () => {
    const content = neutralContent(); content.m2!.lootTables[0]!.dropChance = 1
    const { world, player } = fixture(content, true); const recorder = new Recorder(world)
    for (let n = 0; n < 7200; n++) {
      const operations = n === 0 ? [{ type: 'allocate' as const, nodeId: '1,0' }] : n === 3700 ? [{ type: 'refund' as const, nodeId: '1,0' }] : []
      const command = { ...IDLE_COMMAND, operations }; tick(world, command); recorder.record(command)
    }
    const replay = recorder.exportReplay()
    expect(replay.start.world.tick).toBe(3600); expect(replay.commands).toHaveLength(3600)
    expect(replay.commands.some(c => c.operations?.some(o => o.type === 'refund'))).toBe(true)
    expect(succeeds('verify rotated replay', () => verifyReplay(replay))).toEqual({ ok: true })
    expect(replay.hashes.at(-1)).toEqual([world.tick, hashWorld(world)])
    expect(player.character!.points).toBe(4)
  })

  it('R05 schema 4/m2-sim-v1 only; older debug formats reject', () => {
    const { world } = fixture(); const bytes = serialize(world)
    expect(serialize(restore(bytes))).toBe(bytes)
    for (const field of ['schema', 'build'] as const) {
      const envelope = JSON.parse(bytes); envelope[field] = field === 'schema' ? 3 : 'm1-sim-v1'
      expect(() => restore(JSON.stringify(envelope))).toThrow(/Unsupported/)
    }
  })

  it('R06 every authoritative M2 continuation field enters the canonical hash', () => {
    const { world, player } = fixture(); const before = hashWorld(world)
    for (const change of [
      (w: World) => { w.entities[0]!.character!.graph.seed++ },
      (w: World) => { w.entities[0]!.character!.folds['fold-dart'] = ['long-pleat'] },
      (w: World) => { w.rng.loot![0] = w.rng.loot![0]! ^ 1 },
      (w: World) => { w.nextItemId++ },
      (w: World) => { w.encounter!.attempt++ },
      (w: World) => { w.entities[0]!.skillCooldowns['fold-dart'] = 1 }
    ]) { const copy = restore(serialize(world)); change(copy); expect(hashWorld(copy)).not.toBe(before) }
    expect(player.character!.graph.seed).toBe(7)
  })

  it('R07 queries leave cold/restored and warm hashes identical, returned values detached', () => {
    const { world, player } = fixture(); const victim = target(world)
    const cold = restore(serialize(world)); const before = hashWorld(world)
    const warm = value(previewAction(world, player.id, 'span-cut', victim.id))
    value(inspectStats(world, player.id))
    expect(value(previewAction(cold, player.id, 'span-cut', victim.id))).toEqual(warm)
    warm.recipe.sourceDamage.weight = 999
    expect(hashWorld(world)).toBe(before); expect(hashWorld(cold)).toBe(before)
    paired(world, idle(90))
  })

  it('R08 world replacement resets recording and replay corruption reports first bad checkpoint', () => {
    const { world } = fixture(neutralContent(), true); const recorder = new Recorder(world)
    for (const command of idle(61)) { tick(world, command); recorder.record(command) }
    const replay = recorder.exportReplay(); replay.hashes[1]![1] = '00000000'
    expect(succeeds('verify corrupted replay', () => verifyReplay(replay))).toEqual({ ok: false, divergedAt: 60 })
    const loaded = restore(serialize(world)); recorder.reset(loaded)
    expect(recorder.exportReplay().commands).toEqual([]); expect(recorder.exportReplay().start.world.tick).toBe(61)
    edit(loaded, { type: 'allocate', nodeId: '1,0' })
  })
  it('R09 captured recipe, fan membership and every ailment continuation field affect hashes', () => {
    const { world, player } = fixture(); const victim = target(world); world.tick = 10
    const action = world.content.m2!.actions.find(a => a.id === 'fold-dart')!
    world.actionGroups = [{ id: 'qa-fan', actorId: player.id, actionStartTick: 1, hitTargetIds: [victim.id] }]
    world.projectiles = [{ id: world.nextId++, ownerId: player.id, faction: player.faction, skillId: action.id, actionStartTick: 1,
      pos: { x: .5, z: 0 }, vel: { x: 14, z: 0 }, radius: .12, ageTicks: 1, lifetimeTicks: 43, damage: 16,
      knockback: { speed: 0, ticks: 0 }, impactPauseTicks: 0, hitFlashTicks: 0, groupId: 'qa-fan', recipe: {
        skillId: action.id, tags: [...action.tags], folds: ['splay-pleat'], sourceDamage: { weight: 16, heat: 0, gale: 0 }, modifiers: [], timing: { ...action.timing },
        footprint: { kind: 'projectile', reach: 10, arcRadians: 0, radius: .12, speed: 14, lifetimeTicks: 43, projectileAngles: [-18, 0, 18] } } }]
    world.ailments = [
      { id: 'burden', sourceId: player.id, targetId: victim.id, appliedTick: 1, expiresTick: 91, nextPulseTick: null },
      { id: 'draftbind', sourceId: player.id, targetId: victim.id, appliedTick: 1, expiresTick: 91, nextPulseTick: null },
      { id: 'emberprint', sourceId: player.id, targetId: victim.id, appliedTick: 1, expiresTick: 121, nextPulseTick: 31 }
    ]
    const bytes = serialize(world), before = hashWorld(world)
    expect(serialize(restore(bytes))).toBe(bytes)
    for (const change of [
      (w: World) => { w.projectiles[0]!.recipe!.sourceDamage.weight++ },
      (w: World) => { w.projectiles[0]!.recipe!.timing.recoveryTicks++ },
      (w: World) => { w.projectiles[0]!.recipe!.footprint.radius += .01 },
      (w: World) => { w.actionGroups[0]!.hitTargetIds = [] },
      ...[0,1,2].map(index => (w: World) => { w.ailments[index]!.expiresTick++ }),
      (w: World) => { w.ailments[2]!.appliedTick++ },
      (w: World) => { w.ailments[2]!.sourceId = victim.id },
      (w: World) => { w.ailments[2]!.nextPulseTick!++ }
    ]) { const resumed = restore(bytes); change(resumed); expect(hashWorld(resumed)).not.toBe(before) }
  })

})
