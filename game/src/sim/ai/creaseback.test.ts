import { describe, expect, it } from 'vitest'
import { step } from '../core/loop'
import { hashWorld } from '../core/hash'
import { restore, serialize } from '../core/snapshot'
import { removeEntity } from '../core/store'
import { Button, GAIT, IDLE_COMMAND } from '../core/types'
import type { Command, SimEvent } from '../core/types'
import { buildScenario } from '../scenarios'
import { stepEncounter } from './step'

function duel(distance = 1.1) {
  const world = buildScenario('m1-arena', 7)
  const [player, enemy] = world.entities
  for (const actor of world.entities.slice(2)) removeEntity(world, actor.id)
  player!.pos = { x: 0, z: 0 }
  enemy!.pos = { x: distance, z: 0 }
  return { world, player: player!, enemy: enemy! }
}

function input(buttons = 0, x = 0, z = 0, aim: Command['aim'] = null): Command {
  return { buttons, move: { x, z }, aim }
}

describe('Creaseback intent through shared combat primitives', () => {
  it('acquires, pursues at 1.8 m/s and telegraphs within 1.2 m', () => {
    const { world, enemy } = duel(4)
    expect(enemy.ai!.phase).toBe('idle')
    stepEncounter(world, IDLE_COMMAND, 'm1-arena')
    expect(enemy.ai).toMatchObject({ phase: 'acquire', ageTicks: 0, targetId: world.playerId })
    const start = enemy.pos.x
    stepEncounter(world, IDLE_COMMAND, 'm1-arena')
    expect(enemy.ai!.phase).toBe('chase')
    expect(start - enemy.pos.x).toBeCloseTo(1.8 / 60, 12)
    while (!enemy.action && world.tick < 150) stepEncounter(world, IDLE_COMMAND, 'm1-arena')
    expect(enemy.ai).toMatchObject({ phase: 'telegraph', ageTicks: 0 })
    expect(enemy.action).toMatchObject({ id: 'creaseback-strike', ageTicks: 0 })
    expect(enemy.action!.direction).toBeCloseTo(Math.PI, 12)
    expect(enemy.pos.x).toBeLessThanOrEqual(1.2)
  })

  it('uses 24/3/24 action ages, pauses after contact, and hits once in the active window', () => {
    const { world, enemy, player } = duel()
    while (!enemy.action) stepEncounter(world, IDLE_COMMAND, 'm1-arena')
    const start = enemy.action.startTick
    const events: SimEvent[] = []
    while (enemy.action?.startTick === start && world.tick < 100) {
      const emitted = stepEncounter(world, IDLE_COMMAND, 'm1-arena')
      events.push(...emitted)
      if (!enemy.action || enemy.action.startTick !== start) break
      const age = enemy.action.ageTicks
      expect(enemy.ai!.phase).toBe(age < 24 ? 'telegraph' : age < 27 ? 'strike' : 'recover')
      if (age < 24) expect(player.health).toBe(120)
      if (emitted.some(event => event.type === 'damage')) expect(age).toBe(24)
      if (age === 27) expect(enemy.ai!.ageTicks).toBe(0)
    }
    const damage = events.filter(event => event.type === 'damage')
    expect(damage).toHaveLength(1)
    expect(damage[0]).toMatchObject({ tick: start + 24, amount: 20, targetId: player.id })
    expect(world.tick).toBe(start + 51 + 2)
    expect(player.health).toBe(100)
  })

  it.each(['movement', 'dodge'])('%s evades the committed aim', mode => {
    const { world, player, enemy } = duel()
    player.facing = Math.PI
    player.aim = Math.PI
    while (!enemy.action) stepEncounter(world, IDLE_COMMAND, 'm1-arena')
    const direction = enemy.action.direction
    const start = enemy.action.startTick
    for (let i = 0; i < 28; i++) {
      stepEncounter(world, input(mode === 'dodge' && i === 0 ? Button.Dodge : 0, -1), 'm1-arena')
      expect(enemy.action).toMatchObject({ startTick: start, direction })
    }
    expect(player.health).toBe(120)
    expect(enemy.ai!.phase).toBe('recover')
  })

  it('clears target and intent when a live target is removed; shared action ages finish committed work', () => {
    const { world, player, enemy } = duel()
    while (!enemy.action) stepEncounter(world, IDLE_COMMAND, 'm1-arena')
    const start = enemy.action.startTick
    removeEntity(world, player.id)
    stepEncounter(world, IDLE_COMMAND, 'm1-arena')
    expect(enemy.ai).toMatchObject({ phase: 'idle', targetId: null })
    expect(enemy.action!.startTick).toBe(start)
    expect(enemy.vel).toEqual({ x: 0, z: 0 })
    expect(restore(serialize(world))).toEqual(world)
    for (let tick = 0; tick < 60; tick++) stepEncounter(world, IDLE_COMMAND, 'm1-arena')
    expect(enemy.action).toBeNull()
    expect(enemy.ai).toMatchObject({ phase: 'idle', targetId: null })
  })

  it('breaks equal-distance acquisition ties by id and excludes friendly actors', () => {
    const world = buildScenario('m1-arena', 7)
    const [player, enemy, friendly, hostile] = world.entities
    enemy!.pos = { x: 0, z: 0 }
    player!.pos = { x: -4, z: 0 }
    friendly!.pos = { x: 0, z: 1 }
    hostile!.pos = { x: 4, z: 0 }
    hostile!.faction = 'other'
    stepEncounter(world, IDLE_COMMAND, 'm1-arena')
    expect(enemy!.ai!.targetId).toBe(player!.id)
  })

  it.each([
    ['span-cut', Button.Primary, 3], ['fold-dart', Button.Secondary, 5]
  ] as const)('%s kills in the approved hit count and stops enemy action immediately', (skillId, button, hits) => {
    const { world, player, enemy } = duel()
    const events: SimEvent[] = []
    while (!enemy.death && world.tick < 500) {
      events.push(...stepEncounter(world, input(button, 0, 0, { ...enemy.pos }), 'm1-arena'))
    }
    expect(enemy.death).toMatchObject({ ageTicks: 0, despawnAfterTicks: 30 })
    expect(enemy.ai!.phase).toBe('die')
    expect(enemy.action).toBeNull()
    expect(enemy.vel).toEqual({ x: 0, z: 0 })
    expect(events.filter(event => event.type === 'damage' && event.skillId === skillId)).toHaveLength(hits)
    expect(events.filter(event => event.type === 'death')).toHaveLength(1)
    const health = player.health
    for (let tick = 0; tick < 30; tick++) stepEncounter(world, IDLE_COMMAND, 'm1-arena')
    expect(world.entities.some(actor => actor.id === enemy.id)).toBe(false)
    expect(player.health).toBe(health)
  })

  it('six strikes kill the player; death holds, enemies idle, and reconstruction restarts cleanly', () => {
    const { world, player, enemy } = duel()
    const events: SimEvent[] = []
    for (let tick = 0; tick < 700; tick++) events.push(...stepEncounter(world, IDLE_COMMAND, 'm1-arena'))
    expect(player.health).toBe(0)
    expect(player.death!.despawnAfterTicks).toBeNull()
    expect(events.filter(event => event.type === 'damage' && event.targetId === player.id)).toHaveLength(6)
    expect(events.filter(event => event.type === 'death' && event.targetId === player.id)).toHaveLength(1)
    expect(enemy.ai).toMatchObject({ phase: 'idle', targetId: null })
    const restarted = buildScenario('m1-arena', 7)
    expect(restarted.tick).toBe(0)
    expect(restarted.entities.map(actor => actor.health)).toEqual([120, 72, 72, 72])
    expect(restarted.entities.every(actor => actor.action === null && actor.death === null)).toBe(true)
  })

  it('snapshot continuation preserves the committed windup and all subsequent outcomes', () => {
    const { world, enemy } = duel()
    while (enemy.action?.ageTicks !== 12) stepEncounter(world, IDLE_COMMAND, 'm1-arena')
    const continued = restore(serialize(world))
    for (let tick = 0; tick < 120; tick++) {
      expect(stepEncounter(continued, IDLE_COMMAND, 'm1-arena')).toEqual(stepEncounter(world, IDLE_COMMAND, 'm1-arena'))
      expect(hashWorld(continued)).toBe(hashWorld(world))
    }
  })

  it('keeps player full input at GAIT.runSpeed and M0 adapter outcomes unchanged', () => {
    const world = buildScenario('m1-arena', 7)
    stepEncounter(world, input(0, 1), 'm1-arena')
    expect(world.entities[0]!.gait.speed).toBeCloseTo(GAIT.runSpeed, 12)
    const original = buildScenario('meadow-start', 7)
    const adapter = buildScenario('meadow-start', 7)
    for (let tick = 0; tick < 120; tick++) {
      expect(stepEncounter(adapter, input(0, 1), 'meadow-start')).toEqual(step(original, input(0, 1)))
    }
    expect(serialize(adapter)).toBe(serialize(original))
  })
})
