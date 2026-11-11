import { describe, expect, it } from 'vitest'
import { buildScenario } from '../scenarios'
import { Recorder } from './commands'
import { hashWorld } from './hash'
import { step } from './loop'
import { verifyReplay } from './replay'
import { rngFloat, rngInt } from './rng'
import { restore, serialize } from './snapshot'
import { createWorld, spawnEntity, removeEntity } from './store'
import { BODY_TURN_PER_TICK, GAIT, IDLE_COMMAND } from './types'
import type { Command, World } from './types'

function commandAt(tick: number): Command {
  const direction = Math.floor(tick / 180) % 4
  return {
    move: { x: direction === 0 ? 1 : direction === 2 ? -1 : 0, z: direction === 1 ? 1 : direction === 3 ? -1 : 0 },
    aim: tick % 120 < 60 ? { x: 3, z: -4 } : null,
    buttons: 0
  }
}

function run(world: World, end: number, recorder?: Recorder) {
  while (world.tick < end) {
    const command = commandAt(world.tick)
    step(world, command)
    recorder?.record(command)
  }
}

describe('simulation acceptance', () => {
  it('1: restores at 1,200 and reaches the uninterrupted tick-3,600 hash', () => {
    const uninterrupted = buildScenario('meadow-start', 7)
    run(uninterrupted, 3600)
    const interrupted = buildScenario('meadow-start', 7)
    run(interrupted, 1200)
    const resumed = restore(serialize(interrupted))
    run(resumed, 3600)
    expect(resumed.tick).toBe(3600)
    expect(hashWorld(resumed)).toBe(hashWorld(uninterrupted))
  })

  it('2: verifies every periodic hash from a tick-0 checkpoint and detects altered input', () => {
    const world = buildScenario('meadow-start', 7)
    const recorder = new Recorder(world)
    run(world, 3600, recorder)
    const replay = recorder.exportReplay()
    expect(replay.start.world.tick).toBe(0)
    expect(replay.commands).toHaveLength(3600)
    expect(replay.hashes.filter(([tick]) => tick > 0)).toHaveLength(60)
    expect(verifyReplay(replay)).toEqual({ ok: true })
    replay.commands[0] = { move: { x: -1, z: 0 }, aim: null, buttons: 0 }
    expect(verifyReplay(replay)).toEqual({ ok: false, divergedAt: 60 })
  })

  it('3: round trips canonical bytes, sorts keys and normalizes negative zero', () => {
    const world = buildScenario('meadow-start', 7)
    run(world, 123)
    world.entities[0]!.vel.x = -0
    rngFloat(world, 'z-last')
    rngFloat(world, 'a-first')
    const text = serialize(world)
    expect(serialize(restore(text))).toBe(text)
    expect(serialize(JSON.parse(text).world)).toBe(text)
    expect(text).not.toMatch(/:-0(?=[,}])/)
    expect(Object.is(JSON.parse(text).world.entities[0].vel.x, -0)).toBe(false)
    expect(text.indexOf('"a-first"')).toBeLessThan(text.indexOf('"z-last"'))
    expect(JSON.parse(text)).toMatchObject({ format: 'folio.arpg.snapshot', schema: world.schema, build: world.build })
    expect(hashWorld(world)).toMatch(/^[0-9a-f]{8}$/)
    const bad = buildScenario('meadow-start', 7)
    for (const value of [NaN, Infinity, -Infinity]) {
      bad.entities[0]!.pos.x = value
      expect(() => serialize(bad)).toThrow()
      expect(() => hashWorld(bad)).toThrow()
    }
    expect(() => restore(text.replace('folio.arpg.snapshot', 'other'))).toThrow()
    const envelope = JSON.parse(text)
    envelope.schema++
    expect(() => restore(JSON.stringify(envelope))).toThrow()
  })

  it('5: retains three checkpoints and at least 3,600 ticks through 20,000 ticks', () => {
    const world = buildScenario('meadow-start', 23)
    const recorder = new Recorder(world)
    run(world, 20_000, recorder)
    const replay = recorder.exportReplay()
    expect(replay.start.world.tick).toBe(16_200)
    expect(world.tick - replay.start.world.tick).toBeGreaterThanOrEqual(3600)
    expect(replay.commands).toHaveLength(3800)
    expect(verifyReplay(replay)).toEqual({ ok: true })
    const replayed = restore(JSON.stringify(replay.start))
    for (const command of replay.commands) step(replayed, command)
    expect(hashWorld(replayed)).toBe(hashWorld(world))
  })

  it('6: resets history on restore at tick 10,000 and exports from that restore tick', () => {
    const world = buildScenario('meadow-start', 8)
    const recorder = new Recorder(world)
    run(world, 10_000, recorder)
    const resumed = restore(serialize(world))
    recorder.reset(resumed)
    run(resumed, 10_120, recorder)
    const replay = recorder.exportReplay()
    expect(replay.start.world.tick).toBe(10_000)
    expect(replay.commands).toHaveLength(120)
    expect(verifyReplay(replay)).toEqual({ ok: true })
  })
})

describe('public simulation contracts', () => {
  it('creates empty worlds and assigns stable increasing ids in entity order', () => {
    const world = createWorld(9, 'test-build')
    expect(world).toMatchObject({ seed: 9, build: 'test-build', tick: 0, entities: [], playerId: null })
    const a = spawnEntity(world, { kind: 'dummy', pos: { x: 0, z: 0 }, radius: 0.5 })
    const b = spawnEntity(world, { kind: 'player', pos: { x: 3, z: 0 }, radius: 0.5 })
    expect(b.id).toBe(a.id + 1)
    expect(world.playerId).toBe(b.id)
    expect(removeEntity(world, a.id)).toBe(true)
    const c = spawnEntity(world, { kind: 'dummy', pos: { x: 5, z: 0 }, radius: 0.5 })
    expect(world.entities.map(entity => entity.id)).toEqual([b.id, c.id])
    expect(removeEntity(world, b.id)).toBe(true)
    expect(world.playerId).toBeNull()
    expect(removeEntity(world, a.id)).toBe(false)
  })

  it('seeds independent reproducible streams and preserves draws through snapshots', () => {
    const a = createWorld(77)
    const b = createWorld(77)
    for (let i = 0; i < 100; i++) {
      expect(rngFloat(a, 'combat')).toBe(rngFloat(b, 'combat'))
      rngFloat(a, 'other')
    }
    const resumed = restore(serialize(a))
    for (const stream of ['combat', 'other', '__proto__', 'constructor']) {
      for (let i = 0; i < 100; i++) {
        const value = rngInt(a, stream, 7)
        expect(value).toBe(rngInt(resumed, stream, 7))
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThan(7)
      }
    }
    expect(rngFloat(createWorld(78), 'combat')).not.toBe(rngFloat(createWorld(77), 'combat'))
    expect(() => rngInt(a, 'bad', 0)).toThrow()
  })

  it('runs along its body facing, aims in world space, and resolves even coincident circles', () => {
    const world = createWorld(1)
    const player = spawnEntity(world, { kind: 'player', pos: { x: 0, z: 0 }, radius: 0.5 })
    for (let i = 0; i < 60; i++) step(world, { move: { x: 1, z: 0 }, aim: { x: 0, z: 10 }, buttons: 0 })
    expect(world.tick).toBe(60)
    expect(player.pos.x).toBeCloseTo(GAIT.runSpeed, 10)
    expect(player.pos.z).toBe(0)
    expect(player.facing).toBe(0)
    expect(player.aim).toBeGreaterThan(Math.PI / 2)
    step(world, IDLE_COMMAND)
    expect(player.vel).toEqual({ x: 0, z: 0 })
    expect(player.facing).toBeCloseTo(BODY_TURN_PER_TICK, 10)
    const other = spawnEntity(world, { kind: 'obstacle', pos: { ...player.pos }, radius: 0.5 })
    expect(step(world, IDLE_COMMAND)).toEqual([])
    const dx = player.pos.x - other.pos.x
    const dz = player.pos.z - other.pos.z
    expect(Math.sqrt(dx * dx + dz * dz)).toBeGreaterThanOrEqual(1 - 1e-12)
  })

  it('builds fresh named scenarios with the specified entity counts', () => {
    expect(buildScenario('empty', 7).entities).toHaveLength(0)
    const meadow = buildScenario('meadow-start', 7)
    expect(meadow.entities.filter(entity => entity.kind === 'dummy')).toHaveLength(12)
    expect(meadow.entities.find(entity => entity.id === meadow.playerId)?.pos).toEqual({ x: 0, z: 0 })
    expect(buildScenario('dummies-1000', 7).entities.filter(entity => entity.kind === 'dummy')).toHaveLength(1000)
    expect(serialize(buildScenario('meadow-start', 7))).toBe(serialize(meadow))
    expect(() => buildScenario('unknown', 7)).toThrow()
  })

  it('copies mutable input and exports, checks tick order, and verifies empty or short recordings', () => {
    const world = buildScenario('meadow-start', 7)
    const recorder = new Recorder(world)
    expect(verifyReplay(recorder.exportReplay())).toEqual({ ok: true })
    expect(() => recorder.record(IDLE_COMMAND)).toThrow()
    const command = commandAt(0)
    step(world, command)
    recorder.record(command)
    command.move.x = -1
    const replay = recorder.exportReplay()
    expect(replay.commands[0]?.move.x).toBe(1)
    replay.start.world.tick = -1
    replay.commands[0]!.move.x = 0
    expect(recorder.exportReplay().start.world.tick).toBe(0)
    expect(recorder.exportReplay().commands[0]?.move.x).toBe(1)
    expect(verifyReplay(recorder.exportReplay())).toEqual({ ok: true })
    step(world, IDLE_COMMAND)
    step(world, IDLE_COMMAND)
    expect(() => recorder.record(IDLE_COMMAND)).toThrow()
  })
})
