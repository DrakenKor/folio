import { describe, expect, it } from 'vitest'
import { copyCommand } from './commands'
import { hashWorld } from './hash'
import { verifyReplay } from './replay'
import { restore, serialize } from './snapshot'
import { createWorld, removeEntity, spawnEntity } from './store'
import { actionPhase } from './timing'
import { Button, IDLE_COMMAND, SCHEMA_VERSION, SIM_BUILD } from './types'
import type { ActionTiming, Replay, World } from './types'

const phases: ActionTiming = { windupTicks: 2, activeTicks: 2, recoveryTicks: 3, moveCancelTicks: 1 }

/** Neutral continuation data, without implementing the later combat systems. */
function fixture(): World {
  const world = createWorld(7)
  world.tick = 12
  const shared = { timing: phases, cooldownTicks: 9, damage: 2, knockback: { speed: 1, ticks: 3 }, impactPauseTicks: 2, hitFlashTicks: 6 }
  world.content.skills = [
    { ...structuredClone(shared), id: 'fixture-melee', kind: 'melee', range: 2, arcRadians: 1 },
    { ...structuredClone(shared), id: 'fixture-projectile', kind: 'projectile', speed: 10, radius: 0.1, lifetimeTicks: 30 }
  ]
  world.content.enemies = [{ id: 'fixture-enemy', maxHealth: 10, radius: 0.4, moveSpeed: 1, acquireRange: 8, attackRange: 2, skillId: 'fixture-melee', deathTicks: 20 }]
  world.arena = { center: { x: 2, z: -3 }, radius: 10 }
  const player = spawnEntity(world, {
    kind: 'player', pos: { x: 0, z: 0 }, radius: 0.4, maxHealth: 20, health: 17, aim: 1, facing: 0.5,
    skills: { primary: 'fixture-melee', secondary: 'fixture-projectile' },
    action: { id: 'fixture-melee', kind: 'melee', startTick: 9, ageTicks: 2, direction: 1, hitTargetIds: [2], projectileSpawned: false },
    cooldowns: { primary: 6, secondary: 2, dodge: 3 }, previousButtons: Button.Primary,
    impactPauseTicks: 1, hitFlashTicks: 5, gait: { phase: 3.25, speed: 2 }
  })
  spawnEntity(world, {
    kind: 'fixture-actor', faction: 'fixture-hostile', pos: { x: 2, z: 0 }, radius: 0.4, maxHealth: 10, health: 8,
    knockback: { vel: { x: 1, z: 0 }, remainingTicks: 2 },
    ai: { enemyId: 'fixture-enemy', phase: 'chase', ageTicks: 4, targetId: player.id }
  })
  spawnEntity(world, {
    kind: 'fixture-actor', pos: { x: 4, z: 0 }, radius: 0.4, health: 0,
    death: { startTick: 8, ageTicks: 4, despawnAfterTicks: 20 },
    ai: { enemyId: 'fixture-enemy', phase: 'die', ageTicks: 4, targetId: null }
  })
  world.projectiles.push({
    id: world.nextId++, ownerId: player.id, faction: player.faction, skillId: 'fixture-projectile', actionStartTick: 9,
    pos: { x: 1, z: 1 }, vel: { x: 10, z: 0 }, radius: 0.1, ageTicks: 3, lifetimeTicks: 30,
    damage: 2, knockback: { speed: 1, ticks: 3 }, impactPauseTicks: 2, hitFlashTicks: 6
  })
  return world
}

describe('M1 snapshot contracts', () => {
  it('round trips every owner’s continuation state and detaches restored data', () => {
    const world = fixture()
    const bytes = serialize(world)
    const resumed = restore(bytes)
    expect(resumed).toEqual(world)
    expect(serialize(resumed)).toBe(bytes)
    expect(hashWorld(resumed)).toBe(hashWorld(world))
    resumed.arena!.center.x++
    expect(world.arena!.center).toEqual({ x: 2, z: -3 })
    resumed.entities[0]!.action!.hitTargetIds.push(3)
    resumed.content.skills[0]!.timing.activeTicks++
    expect(world.entities[0]!.action!.hitTargetIds).toEqual([2])
    expect(world.content.skills[0]!.timing.activeTicks).toBe(2)
  })

  it.each([
    ['windup', 0], ['active', 2], ['recovery', 4]
  ] as const)('restores %s from action age rather than elapsed world ticks', (phase, age) => {
    const world = fixture()
    world.entities[0]!.action!.ageTicks = age
    world.entities[0]!.action!.startTick = 6
    const resumed = restore(serialize(world))
    expect(actionPhase(resumed.content.skills[0]!.timing, resumed.entities[0]!.action!.ageTicks)).toBe(phase)
  })

  it('restores dodge and the one-shot projectile launch latch', () => {
    const world = fixture()
    const action = world.entities[0]!.action!
    action.id = 'dodge'
    action.kind = 'dodge'
    action.hitTargetIds = []
    expect(restore(serialize(world)).entities[0]!.action).toEqual(action)
    action.id = 'fixture-projectile'
    action.kind = 'projectile'
    action.projectileSpawned = true
    expect(restore(serialize(world)).entities[0]!.action!.projectileSpawned).toBe(true)
  })

  const malformed: Array<[string, (world: World) => void]> = [
    ['negative health', w => { w.entities[0]!.health = -1 }],
    ['excess health', w => { w.entities[0]!.health = 21 }],
    ['missing health', w => { Reflect.deleteProperty(w.entities[0]!, 'health') }],
    ['missing death', w => { w.entities[0]!.health = 0 }],
    ['fractional cooldown', w => { w.entities[0]!.cooldowns.primary = 0.5 }],
    ['negative pause', w => { w.entities[0]!.impactPauseTicks = -1 }],
    ['fractional action age', w => { w.entities[0]!.action!.ageTicks = 1.5 }],
    ['completed action', w => { w.entities[0]!.action!.ageTicks = 7 }],
    ['future action', w => { w.entities[0]!.action!.startTick = 13 }],
    ['duplicate hit', w => { w.entities[0]!.action!.hitTargetIds = [2, 2] }],
    ['unordered hits', w => { w.entities[0]!.action!.hitTargetIds = [3, 2] }],
    ['negative gait', w => { w.entities[0]!.gait.phase = -1 }],
    ['expired knockback', w => { w.entities[1]!.knockback!.remainingTicks = 0 }],
    ['unknown target', w => { w.entities[1]!.ai!.targetId = 100 }],
    ['negative AI age', w => { w.entities[1]!.ai!.ageTicks = -1 }],
    ['expired death', w => { w.entities[2]!.death!.despawnAfterTicks = 4 }],
    ['AI-free timed death', w => { w.entities[2]!.ai = null }],
    ['mismatched enemy death duration', w => { w.entities[2]!.death!.despawnAfterTicks = 21 }],
    ['permanent enemy death', w => { w.entities[2]!.death!.despawnAfterTicks = null }],
    ['dead action', w => { w.entities[2]!.action = structuredClone(w.entities[0]!.action) }],
    ['negative projectile radius', w => { w.projectiles[0]!.radius = -0.1 }],
    ['fractional projectile lifetime', w => { w.projectiles[0]!.lifetimeTicks = 0.5 }],
    ['expired projectile', w => { w.projectiles[0]!.ageTicks = 30 }],
    ['missing projectile velocity', w => { Reflect.deleteProperty(w.projectiles[0]!, 'vel') }],
    ['unknown owner', w => { w.projectiles[0]!.ownerId = 100 }],
    ['dead owner', w => { w.projectiles[0]!.ownerId = 3 }],
    ['projectile id collision', w => { w.projectiles[0]!.id = 2 }],
    ['unknown projectile skill', w => { w.projectiles[0]!.skillId = 'missing' }],
    ['future projectile launch', w => { w.projectiles[0]!.actionStartTick = 13 }],
    ['negative projectile damage', w => { w.projectiles[0]!.damage = -1 }],
    ['fractional phase length', w => { w.content.skills[0]!.timing.windupTicks = 0.5 }],
    ['empty active phase', w => { w.content.skills[0]!.timing.activeTicks = 0 }],
    ['late movement cancel', w => { w.content.skills[0]!.timing.moveCancelTicks = 4 }],
    ['invalid immunity bounds', w => { w.content.dodge.invulnerableUntil = 11 }],
    ['missing skills', w => { Reflect.deleteProperty(w, 'content') }],
    ['zero arena radius', w => { w.arena!.radius = 0 }],
    ['negative arena radius', w => { w.arena!.radius = -1 }],
    ['missing arena radius', w => { Reflect.deleteProperty(w.arena!, 'radius') }],
    ['missing arena centre', w => { Reflect.deleteProperty(w.arena!, 'center') }],
    ['invalid arena centre', w => { Reflect.deleteProperty(w.arena!.center, 'x') }],
    ['rectangular arena', w => { Reflect.set(w, 'arena', { min: { x: -10, z: -10 }, max: { x: 10, z: 10 } }) }],
    ['unknown button', w => { w.entities[0]!.previousButtons = 256 }]
  ]
  it.each(malformed)('rejects %s', (_name, mutate) => {
    const world = fixture()
    mutate(world)
    expect(() => restore(serialize(world))).toThrow(/Invalid snapshot/)
  })

  it('restores an unbounded arena and AI-free terminal pose without defaults', () => {
    const world = fixture()
    world.arena = null
    world.entities[2]!.ai = null
    world.entities[2]!.death!.despawnAfterTicks = null
    expect(restore(serialize(world))).toEqual(world)
    expect(createWorld(7).arena).toBeNull()
  })

  it('rejects M0 snapshots/replays and unsupported simulation builds clearly', () => {
    const envelope = JSON.parse(serialize(fixture()))
    envelope.schema = envelope.world.schema = 1
    envelope.build = envelope.world.build = 'm0-sim-v1'
    expect(() => restore(JSON.stringify(envelope))).toThrow(/Unsupported snapshot format or schema/)
    const replay: Replay = { format: 'folio.arpg.replay', start: envelope, commands: [], hashes: [] }
    expect(() => verifyReplay(replay)).toThrow(/Unsupported snapshot format or schema/)
    envelope.schema = envelope.world.schema = SCHEMA_VERSION
    expect(() => restore(JSON.stringify(envelope))).toThrow(/Unsupported simulation build/)
    envelope.build = envelope.world.build = 'm1-sim-v2'
    expect(() => restore(JSON.stringify(envelope))).toThrow(/Unsupported simulation build/)
    expect(SIM_BUILD).toBe('m1-sim-v3')
  })

  it('hashes mutable combat, gait, AI, projectile and input continuation data', () => {
    const mutations: Array<(world: World) => void> = [
      w => { w.entities[0]!.health-- }, w => { w.entities[0]!.aim++ },
      w => { w.entities[0]!.action!.ageTicks++ }, w => { w.entities[0]!.gait.phase += 0.1 },
      w => { w.entities[0]!.previousButtons = Button.Dodge }, w => { w.entities[0]!.impactPauseTicks++ },
      w => { w.entities[1]!.ai!.ageTicks++ }, w => { w.entities[2]!.death!.ageTicks++ },
      w => { w.projectiles[0]!.ageTicks++ }, w => { w.content.skills[0]!.damage++ },
      w => { w.arena!.center.x++ }, w => { w.arena!.radius++ }
    ]
    const initial = hashWorld(fixture())
    for (const mutate of mutations) {
      const world = fixture()
      mutate(world)
      expect(hashWorld(world)).not.toBe(initial)
    }
  })

  it('detaches constructor inputs and removes dangling projectile owners/AI targets', () => {
    const world = fixture()
    const source = structuredClone(world.entities[0]!)
    const copy = spawnEntity(world, source)
    source.action!.hitTargetIds.push(3)
    source.gait.phase = 99
    expect(copy.action!.hitTargetIds).toEqual([2])
    expect(copy.gait.phase).toBe(3.25)
    removeEntity(world, 1)
    expect(world.projectiles).toEqual([])
    expect(world.entities[0]!.ai!.targetId).toBeNull()
  })
})

describe('integer phase boundaries', () => {
  it.each([
    [0, 'windup'], [1, 'windup'], [2, 'active'], [3, 'active'],
    [4, 'recovery'], [5, 'recovery'], [6, 'recovery'], [7, 'complete'], [8, 'complete']
  ] as const)('classifies age %i as %s', (age, expected) => {
    expect(actionPhase(phases, age)).toBe(expected)
  })

  it('allows a zero windup and zero recovery', () => {
    const timing = { windupTicks: 0, activeTicks: 1, recoveryTicks: 0, moveCancelTicks: 0 }
    expect(actionPhase(timing, 0)).toBe('active')
    expect(actionPhase(timing, 1)).toBe('complete')
  })

  it('accepts defined held bits and rejects negative, fractional or unknown button bits', () => {
    expect(copyCommand({ ...IDLE_COMMAND, buttons: Button.Primary | Button.Dodge }).buttons).toBe(5)
    for (const buttons of [-1, 0.5, 256]) expect(() => copyCommand({ ...IDLE_COMMAND, buttons })).toThrow(/Invalid command/)
  })
})
