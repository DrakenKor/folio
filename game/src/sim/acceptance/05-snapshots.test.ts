import { describe, expect, it } from 'vitest'
import { hashWorld, restore, serialize, step } from '../core'
import { Button } from '../core/types'
import type { Command, World } from '../core/types'
import { advance, command, contentCases, fixture, incoming, m1Content, target } from './fixtures'

const states = ['changing gait', 'windup', 'active', 'recovery', 'dodge', 'impact pause', 'projectile flight', 'death'] as const

function observations(world: World) {
  return world.entities.map(actor => ({
    id: actor.id, health: actor.health, action: actor.action, gait: actor.gait,
    death: actor.death, cooldowns: actor.cooldowns, previousButtons: actor.previousButtons
  }))
}

describe('5: snapshot continuation', () => {
  it.each(contentCases)('$name fixture data restores without hidden registration', ({ build }) => {
    const { world, player } = fixture(build())
    target(world)
    incoming(world, player)
    expect(restore(serialize(world))).toEqual(world)
    expect(world.entities.every(actor => actor.ai === null)).toBe(true)
  })

  it.each(states)('restores during %s and matches uninterrupted outcomes every following tick', state => {
    const useM1 = state === 'impact pause' || state === 'death'
    const { world, player } = fixture(useM1 ? m1Content() : undefined, state === 'death' ? { health: 10 } : {})
    let continuation: Command = command()
    if (state === 'changing gait') {
      advance(world, 8, command(0, { x: 0.25, z: 0 }))
      const first = player.gait.phase
      advance(world, 8, command(0, { x: 1, z: 0 }))
      expect.soft(player.gait.phase).toBeGreaterThan(first)
      expect.soft(player.gait.speed).toBeGreaterThan(0)
      continuation = command(0, { x: 0, z: 0.5 }, { x: -100, z: 0 })
    } else if (state === 'windup') {
      advance(world, 2, command(Button.Primary))
      expect.soft(player.action).toMatchObject({ id: 'fixture-melee', ageTicks: 1, direction: 0 })
      continuation = command(0, undefined, { x: 0, z: 100 })
    } else if (state === 'active') {
      const victim = target(world)
      advance(world, 3, command(Button.Primary))
      expect.soft(player.action).toMatchObject({ ageTicks: 2, hitTargetIds: [victim.id] })
      expect.soft(victim.health).toBe(65)
    } else if (state === 'recovery') {
      advance(world, 5, command(Button.Primary))
      expect.soft(player.action).toMatchObject({ ageTicks: 4 })
      continuation = command(0, { x: 1, z: 0 })
    } else if (state === 'dodge') {
      advance(world, 2, command(Button.Dodge))
      incoming(world, player)
      expect.soft(player.action).toMatchObject({ id: 'dodge', ageTicks: 1 })
      expect.soft(player.pos.x).toBeCloseTo(0.6, 10)
      expect.soft(player.previousButtons).toBe(Button.Dodge)
      continuation = command(Button.Dodge)
    } else if (state === 'impact pause') {
      target(world)
      advance(world, 7, command(Button.Primary))
      expect.soft(player.action).toMatchObject({ id: 'span-cut', ageTicks: 6 })
      expect.soft(player.impactPauseTicks).toBe(2)
    } else if (state === 'projectile flight') {
      target(world, { x: 2.5, z: 0 }, { radius: 0.1 })
      advance(world, 4, command(Button.Secondary))
      expect.soft(player.action).toMatchObject({ id: 'fixture-projectile', ageTicks: 3, projectileSpawned: true })
      expect.soft(world.projectiles).toHaveLength(1)
      expect.soft(world.projectiles[0]).toMatchObject({ ageTicks: 1, pos: { x: 1, z: 0 } })
    } else {
      incoming(world, player)
      step(world, command())
      expect.soft(player.health).toBe(0)
      expect.soft(player.death).toMatchObject({ startTick: 1, ageTicks: 0 })
      continuation = command(Button.Primary | Button.Dodge, { x: 1, z: 0 })
    }

    const bytes = serialize(world)
    const resumed = restore(bytes)
    expect(serialize(resumed)).toBe(bytes)
    expect(hashWorld(resumed)).toBe(hashWorld(world))
    const laterEvents = []
    for (let tick = 0; tick < 60; tick++) {
      const uninterrupted = step(world, continuation)
      laterEvents.push(...uninterrupted)
      expect(step(resumed, continuation)).toEqual(uninterrupted)
      expect(hashWorld(resumed)).toBe(hashWorld(world))
      expect(observations(resumed)).toEqual(observations(world))
      expect(resumed.projectiles).toEqual(world.projectiles)
    }
    if (state === 'active') {
      expect.soft(world.entities[1]?.health).toBe(65)
      expect(laterEvents.filter(event => event.type === 'hit')).toEqual([])
    }
    if (state === 'projectile flight') {
      expect.soft(world.entities[1]?.health).toBe(67)
      expect.soft(laterEvents.filter(event => event.type === 'hit')).toHaveLength(1)
      expect.soft(world.projectiles).toEqual([])
    }
    if (state === 'death') {
      expect(laterEvents.filter(event => event.type === 'hit' || event.type === 'damage' || event.type === 'death')).toEqual([])
    }
  })
})
