import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import { runFight } from '../../../scenarios/m1-fight'
import type { ScriptEntry } from '../../../scenarios/m1-fight'
import { Recorder } from '../core/commands'
import { hashWorld } from '../core/hash'
import { step } from '../core/loop'
import { verifyReplay } from '../core/replay'
import { restore, serialize } from '../core/snapshot'
import { IDLE_COMMAND } from '../core/types'
import { buildScenario, encounterOutcome } from '../scenarios'

const script: ScriptEntry[] = JSON.parse(readFileSync(new URL('../../../scenarios/m1-fight-commands.json', import.meta.url), 'utf8'))
const expected = JSON.parse(readFileSync(new URL('../../../scenarios/m1-fight.json', import.meta.url), 'utf8'))
let fight: ReturnType<typeof runFight>
beforeAll(() => { fight = runFight(script) })

describe('M1 authored fight fixtures', () => {
  it('runs 7200 commands with normal health, both skills, incoming damage, dodges, knockback and 36 deaths', () => {
    expect(fight.report).toMatchObject({
      ticks: 7200, outgoingDamage: 36 * 72, incomingDamage: 20, enemyDeaths: 36, playerDeaths: 0,
      playerHealth: 100, incomingKnockback: true, enemyKnockback: true, impactPause: true
    })
    expect(fight.report.dodges).toBeGreaterThan(0)
    expect(fight.report.spanCutHits).toBeGreaterThan(0)
    expect(fight.report.foldDartHits).toBeGreaterThan(0)
    expect(fight.report).toMatchObject(Object.fromEntries(Object.entries(expected).filter(([key]) => key !== 'checkpoints' && key !== 'replayVerified')))
    expect(fight.replay.commands).toHaveLength(7200)
    expect(fight.world.entities).toHaveLength(1)
    expect(encounterOutcome(fight.world, 'm1-fight')).toBe('victory')
    expect(restore(serialize(fight.world))).toEqual(fight.world)
  })

  it('publishes only the scheduled trios at ticks 600..6600, with monotonic actor ids', () => {
    const spawns = fight.events.filter(event => event.type === 'spawn')
    expect(spawns).toHaveLength(33)
    expect(spawns.map(event => event.tick)).toEqual(Array.from({ length: 11 }, (_, i) => [600 * (i + 1), 600 * (i + 1), 600 * (i + 1)]).flat())
    expect(spawns.map(event => event.id)).toEqual([...spawns.map(event => event.id)].sort((a, b) => a - b))
    expect(new Set(spawns.map(event => event.id)).size).toBe(33)
  })

  it('verifies all 121 committed hashes and the recorder window after checkpoint rotation', () => {
    expect(fight.replay.hashes).toEqual(expected.checkpoints)
    expect(fight.replay.hashes.map(([tick]) => tick)).toEqual(Array.from({ length: 121 }, (_, i) => i * 60))
    expect(fight.replay.hashes.at(-1)).toEqual([7200, expected.finalHash])
    expect(verifyReplay(fight.replay)).toEqual({ ok: true })
    expect(fight.retained.start.world.tick).toBe(3600)
    expect(fight.retained.commands).toHaveLength(3600)
    expect(verifyReplay(fight.retained)).toEqual({ ok: true })
  })

  it('reports the first affected periodic hash when the first attack is removed', () => {
    const changed = structuredClone(fight.replay)
    const first = changed.commands.findIndex(command => command.buttons !== 0)
    const checkpoint = Math.ceil((first + 1) / 60) * 60
    for (let i = first; i < checkpoint; i++) changed.commands[i]!.buttons = 0
    expect(verifyReplay(changed)).toEqual({ ok: false, divergedAt: checkpoint })
  })

  it('repeats seed/script runs with identical damage, deaths, ids, canonical state and hashes', () => {
    const repeated = runFight(script)
    expect(repeated.events).toEqual(fight.events)
    expect(repeated.report).toEqual(fight.report)
    expect(repeated.replay.hashes).toEqual(fight.replay.hashes)
    expect(serialize(repeated.world)).toBe(serialize(fight.world))
  })

  it('does not replace an uncleared trio or queue a missed scheduled wave', () => {
    const world = buildScenario('m1-fight', 7)
    // Isolate scheduling from combat in fixture setup; all actors retain normal health.
    for (const actor of world.entities.slice(1)) actor.faction = 'player'
    for (let tick = 0; tick < 601; tick++) step(world, IDLE_COMMAND)
    expect(world.entities).toHaveLength(4)
    expect(world.nextId).toBe(5)
  })

  it('reports arena victory on death and holds fight victory until tick 7200', () => {
    const world = buildScenario('m1-fight', 7)
    let command = IDLE_COMMAND
    let entry = 0
    while (world.tick < 600) {
      if (script[entry]?.tick === world.tick) command = script[entry++]!.command
      step(world, command)
      if (world.entities.slice(1).every(actor => actor.death)) {
        expect(encounterOutcome(world, 'm1-arena')).toBe('victory')
        expect(encounterOutcome(world, 'm1-fight')).toBe('ongoing')
        expect(world.entities.length).toBeGreaterThan(1)
        break
      }
    }
    expect(world.entities.slice(1).every(actor => actor.death)).toBe(true)
  })

  it('runs the separate death fixture and resets the recorder with reconstruction', () => {
    const fixture = JSON.parse(readFileSync(new URL('../../../scenarios/m1-death.json', import.meta.url), 'utf8'))
    const world = buildScenario(fixture.scenario, fixture.seed)
    const recorder = new Recorder(world)
    for (let tick = 0; tick < fixture.ticks; tick++) {
      step(world, IDLE_COMMAND)
      recorder.record(IDLE_COMMAND)
    }
    expect(world.entities[0]!.health).toBe(0)
    expect(encounterOutcome(world, fixture.scenario)).toBe('defeat')
    expect(world.entities[0]!.death!.despawnAfterTicks).toBeNull()
    const restarted = buildScenario(fixture.scenario, fixture.seed)
    recorder.reset(restarted)
    expect(recorder.exportReplay().commands).toEqual([])
    expect(recorder.exportReplay().hashes).toEqual([[0, hashWorld(restarted)]])
    expect(restarted.entities.map(actor => actor.health)).toEqual([120, 72, 72, 72])
  })

  it('runs the separate synthetic stress fixture for 600 ticks with at most sixteen live darts', () => {
    const world = buildScenario('m1-stress', 7)
    let peak = world.projectiles.length
    for (let tick = 0; tick < 600; tick++) {
      step(world, IDLE_COMMAND)
      peak = Math.max(peak, world.projectiles.length)
    }
    expect(peak).toBe(16)
    expect(world.entities).toHaveLength(13)
    expect(world.tick).toBe(600)
    expect(restore(serialize(world))).toEqual(world)
  })
})
