import { describe, expect, it } from 'vitest'
import { restore, serialize, step } from '../core'
import { Button } from '../core/types'
import { advance, command, fixture, incoming, m1Content, projectile, target } from './fixtures'

describe('4: damage, knockback, pause and death', () => {
  it('applies incoming fixed damage with ordered, detached impact events', () => {
    const { world, player } = fixture(m1Content())
    const shot = incoming(world, player)
    expect(() => restore(serialize(world))).not.toThrow()
    const events = step(world, command())
    expect(player.health).toBe(104)
    expect(events.map(event => event.type)).toEqual(['hit', 'damage'])
    expect(events[0]).toMatchObject({ type: 'hit', tick: 1, actorId: shot.ownerId, targetId: player.id, skillId: 'fold-dart', actionStartTick: 0, projectileId: shot.id })
    expect(events[1]).toMatchObject({ type: 'damage', tick: 1, actorId: shot.ownerId, targetId: player.id, amount: 16, health: 104 })
    const impact = events.find(event => event.type === 'hit')!
    expect(Number.isFinite(impact.position.x) && Number.isFinite(impact.position.z)).toBe(true)
    const saved = { ...impact.position }
    player.pos.x += 10
    expect(impact.position).toEqual(saved)
  })

  it.each([false, true])('moves bounded knockback for exactly four unpaused ticks, bounds=%s', bounded => {
    const { world, player } = fixture(m1Content())
    if (bounded) world.arena = { min: { x: -10, z: -10 }, max: { x: 0.1, z: 10 } }
    incoming(world, player, { knockback: { speed: 0.15 * 60 / 4, ticks: 4 } })
    step(world, command())
    expect(player.knockback).toMatchObject({ vel: { x: 2.25, z: 0 }, remainingTicks: 4 })
    advance(world, 2)
    expect(player.pos.x).toBe(0)
    for (let age = 1; age <= 4; age++) {
      step(world, command())
      expect(player.pos.x).toBeCloseTo(Math.min(0.15 * age / 4, bounded ? 0.1 : 0.15), 10)
      expect(player.gait).toEqual({ phase: 0, speed: 0 })
    }
    expect(player.knockback).toBeNull()
    const end = { ...player.pos }
    step(world, command())
    expect(player.pos).toEqual(end)
  })

  it('replaces knockback with the latest ordered hit and takes maximum pause/flash', () => {
    const { world, player } = fixture(m1Content())
    incoming(world, player, { impactPauseTicks: 4, hitFlashTicks: 8, knockback: { speed: 3, ticks: 4 } })
    step(world, command())
    const owner = target(world, { x: 0, z: -4 })
    projectile(world, owner, { pos: { x: 0, z: -1 }, vel: { x: 0, z: 120 }, impactPauseTicks: 2, hitFlashTicks: 6, knockback: { speed: 1, ticks: 2 } })
    step(world, command())
    expect(player.health).toBe(88)
    expect(player.impactPauseTicks).toBe(3)
    expect(player.hitFlashTicks).toBe(7)
    expect(player.knockback).toEqual({ vel: { x: 0, z: 1 }, remainingTicks: 2 })
  })

  it('freezes processed action age for exactly the two ticks following a melee hit', () => {
    const { world, player } = fixture(m1Content())
    const victim = target(world)
    advance(world, 7, command(Button.Primary))
    expect(victim.health).toBe(48)
    expect(player.action).toMatchObject({ ageTicks: 6 })
    expect(player.impactPauseTicks).toBe(2)
    for (const remaining of [1, 0]) {
      step(world, command())
      expect(player.action?.ageTicks).toBe(6)
      expect(player.impactPauseTicks).toBe(remaining)
    }
    step(world, command())
    expect(player.action?.ageTicks).toBe(7)
    expect(victim.health).toBe(48)
  })

  it('keeps world timers, aim/buttons and projectile flight running while actor processing is frozen', () => {
    const { world, player } = fixture()
    step(world, command(Button.Primary))
    player.impactPauseTicks = 2
    player.hitFlashTicks = 3
    player.cooldowns.dodge = 5
    player.gait = { phase: 0.75, speed: 0.561 }
    player.knockback = { vel: { x: 1, z: 0 }, remainingTicks: 4 }
    const shot = projectile(world, player, { pos: { x: 10, z: 0 } })
    expect(() => restore(serialize(world))).not.toThrow()
    const held = command(Button.Dodge, { x: 0, z: 1 }, { x: 0, z: 100 })
    for (let i = 1; i <= 2; i++) {
      const events = step(world, held)
      expect(world.tick).toBe(1 + i)
      expect(player.action?.ageTicks).toBe(0)
      expect(player.pos).toEqual({ x: 0, z: 0 })
      expect(player.facing).toBe(0)
      expect(player.aim).toBeCloseTo(Math.PI / 2, 8)
      expect(player.previousButtons).toBe(Button.Dodge)
      expect(player.cooldowns.dodge).toBe(5 - i)
      expect(player.hitFlashTicks).toBe(3 - i)
      expect(player.gait).toEqual({ phase: 0.75, speed: 0.561 })
      expect(player.knockback?.remainingTicks).toBe(4)
      expect(shot.ageTicks).toBe(i)
      expect(shot.pos.x).toBeCloseTo(10 + i * 0.5, 10)
      expect(events.filter(event => event.type === 'dodge')).toEqual([])
    }
    advance(world, 6, held)
    expect(player.action?.kind).not.toBe('dodge')
  })

  it('shows hit flash on the hit tick through F-1 and clears at F', () => {
    const { world, player } = fixture(m1Content())
    incoming(world, player)
    step(world, command())
    for (let remaining = 6; remaining >= 0; remaining--) {
      expect(player.hitFlashTicks).toBe(remaining)
      step(world, command())
    }
  })

  it('pauses only the target of a projectile impact', () => {
    const { world, player } = fixture(m1Content())
    const shot = incoming(world, player)
    step(world, command())
    expect(player.impactPauseTicks).toBe(2)
    expect(world.entities.find(actor => actor.id === shot.ownerId)?.impactPauseTicks).toBe(0)
  })

  it.each([Button.Primary, Button.Secondary])('positive damage cancels pending attack button %i before it can hit or launch', button => {
    const { world, player } = fixture()
    step(world, command(button))
    expect(player.action).not.toBeNull()
    incoming(world, player)
    step(world, command())
    expect(player.action).toBeNull()
    const later = advance(world, 20)
    expect(later.filter(event => event.type === 'hit' && event.actorId === player.id)).toEqual([])
    expect(world.projectiles.filter(shot => shot.ownerId === player.id)).toEqual([])
  })

  it('does not interrupt an action when an incoming contact deals zero damage', () => {
    const { world, player } = fixture()
    step(world, command(Button.Secondary))
    incoming(world, player, { damage: 0 })
    step(world, command())
    expect(player.health).toBe(120)
    expect(player.action).toMatchObject({ id: 'fixture-projectile', ageTicks: 1 })
  })

  it('clamps lethal damage, emits death once and cancels all owned and pending attacks', () => {
    const { world, player } = fixture(m1Content(), { health: 10 })
    step(world, command(Button.Primary))
    projectile(world, player, { pos: { x: 10, z: 0 } })
    const shot = incoming(world, player)
    const events = step(world, command())
    expect(player.health).toBe(0)
    expect(events.map(event => event.type)).toEqual(['hit', 'damage', 'death'])
    expect(events[1]).toMatchObject({ type: 'damage', amount: 10, health: 0 })
    expect(events[2]).toMatchObject({ type: 'death', actorId: shot.ownerId, targetId: player.id, tick: 2 })
    expect(player).toMatchObject({ action: null, vel: { x: 0, z: 0 }, knockback: null, impactPauseTicks: 0, gait: { speed: 0 }, death: { startTick: 2, ageTicks: 0, despawnAfterTicks: null } })
    expect(world.projectiles).toEqual([])
    const pos = { ...player.pos }
    const later = advance(world, 120, command(Button.Primary | Button.Secondary | Button.Dodge, { x: 1, z: 0 }))
    expect(player.pos).toEqual(pos)
    expect(player.action).toBeNull()
    expect(player.previousButtons).toBe(Button.Primary | Button.Secondary | Button.Dodge)
    expect(later.filter(event => event.type === 'death' || event.type === 'hit' || event.type === 'damage')).toEqual([])
    expect(world.entities).toContain(player)
    expect(player.death?.ageTicks).toBe(120)
  })

  it('excludes dead actors from collision and removes seeded enemy death at its exact duration', () => {
    const { world, player } = fixture()
    const dead = target(world, { ...player.pos }, { health: 0, death: { startTick: 0, ageTicks: 0, despawnAfterTicks: 30 } })
    expect(() => restore(serialize(world))).not.toThrow()
    advance(world, 29)
    expect(player.pos).toEqual({ x: 0, z: 0 })
    expect(dead.pos).toEqual({ x: 0, z: 0 })
    expect(dead.death?.ageTicks).toBe(29)
    expect(world.entities).toContain(dead)
    expect(step(world, command())).toContainEqual({ type: 'despawn', id: dead.id, tick: 30 })
    expect(world.entities).not.toContain(dead)
    expect(advance(world, 2).filter(event => event.type === 'despawn')).toEqual([])
  })

  it('consumes immune contact without damage, feedback or action interruption', () => {
    const { world, player } = fixture(m1Content())
    step(world, command(Button.Dodge))
    step(world, command())
    incoming(world, player)
    const events = step(world, command())
    expect(player.health).toBe(120)
    expect(player.action).toMatchObject({ id: 'dodge', ageTicks: 2 })
    expect(player.impactPauseTicks).toBe(0)
    expect(player.hitFlashTicks).toBe(0)
    expect(player.knockback).toBeNull()
    expect(events.filter(event => event.type === 'hit' || event.type === 'damage')).toEqual([])
    expect(world.projectiles).toEqual([])
  })
})
