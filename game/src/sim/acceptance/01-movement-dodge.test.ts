import { describe, expect, it } from 'vitest'
import { step } from '../core'
import { BODY_TURN_PER_TICK, Button } from '../core/types'
import { advance, command, contentCases, fixture, incoming, m1Content } from './fixtures'

describe('1: movement, aim and dodge', () => {
  it('normalizes diagonal speed and bounds turning toward movement independently of aim', () => {
    const cardinal = fixture()
    const diagonal = fixture()
    step(cardinal.world, command(0, { x: 1, z: 0 }, { x: 0, z: 100 }))
    step(diagonal.world, command(0, { x: 1, z: 1 }, { x: 0, z: 100 }))
    const distance = (pos: { x: number; z: number }) => Math.sqrt(pos.x * pos.x + pos.z * pos.z)
    expect(distance(diagonal.player.pos)).toBeCloseTo(distance(cardinal.player.pos), 10)
    expect(cardinal.player.aim).toBeCloseTo(Math.PI / 2, 8)
    expect(cardinal.player.facing).toBe(0)
    expect(diagonal.player.facing).toBeCloseTo(BODY_TURN_PER_TICK, 8)
    expect(diagonal.player.vel.z).toBeGreaterThan(0)
  })

  it('retains null/coincident aim and turns idle bodies at the maximum rate', () => {
    const { world, player } = fixture(undefined, { aim: Math.PI, facing: 0 })
    step(world, command(0, undefined, null))
    expect(player.aim).toBe(Math.PI)
    expect(player.facing).toBeCloseTo(BODY_TURN_PER_TICK, 8)
    step(world, command(0, undefined, { ...player.pos }))
    expect(player.aim).toBe(Math.PI)
    expect(player.facing).toBeCloseTo(2 * BODY_TURN_PER_TICK, 8)
  })

  it('locks action aim while subsequent pointer movement still updates aim', () => {
    const { world, player } = fixture()
    step(world, command(Button.Primary))
    expect(player.action).toMatchObject({ direction: 0, startTick: 1 })
    step(world, command(0, undefined, { x: 0, z: 100 }))
    expect(player.aim).toBeCloseTo(Math.PI / 2, 8)
    expect(player.action?.direction).toBe(0)
    expect(player.facing).toBe(0)
  })

  describe.each(contentCases)('$name dodge', ({ build }) => {
    it.each(['movement', 'facing'] as const)('travels configured distance using %s, without adding gait steps', direction => {
      const { world, player } = fixture(build(), { facing: Math.PI / 2 })
      const move = direction === 'movement' ? { x: 1, z: 0 } : { x: 0, z: 0 }
      step(world, command(Button.Dodge, move))
      expect(player.action).toMatchObject({ id: 'dodge', ageTicks: 0 })
      advance(world, world.content.dodge.timing.activeTicks - 1, command())
      expect(player.pos.x).toBeCloseTo(direction === 'movement' ? world.content.dodge.distance : 0, 8)
      expect(player.pos.z).toBeCloseTo(direction === 'facing' ? world.content.dodge.distance : 0, 8)
      expect(player.gait).toEqual({ phase: 0, speed: 0 })
      const end = { ...player.pos }
      step(world, command())
      expect(player.pos).toEqual(end)
    })

    it('includes exactly the half-open immunity interval and adjacent ages', () => {
      const dodge = build().dodge
      for (const age of [dodge.invulnerableFrom - 1, dodge.invulnerableFrom, dodge.invulnerableFrom + 1, dodge.invulnerableUntil - 1, dodge.invulnerableUntil, dodge.invulnerableUntil + 1]) {
        const { world, player } = fixture(build())
        if (age > 0) {
          step(world, command(Button.Dodge))
          advance(world, age - 1)
        }
        incoming(world, player)
        const events = step(world, command(age === 0 ? Button.Dodge : 0))
        const immune = age >= dodge.invulnerableFrom && age < dodge.invulnerableUntil
        expect(player.health, `damage at dodge age ${age}`).toBe(immune ? 120 : 120 - world.content.skills.find(skill => skill.kind === 'projectile')!.damage)
        expect(events.some(event => event.type === 'damage')).toBe(!immune)
      }
    })

    it('becomes ready at start plus cooldown, checking before, at and after', () => {
      for (const offset of [-1, 0, 1]) {
        const { world, player } = fixture(build())
        const cooldown = world.content.dodge.cooldownTicks
        step(world, command(Button.Dodge))
        advance(world, cooldown + offset - 1)
        step(world, command(Button.Dodge))
        expect(player.action, `cooldown offset ${offset}`).toEqual(offset < 0 ? null : expect.objectContaining({ id: 'dodge', startTick: 1 + cooldown + offset, ageTicks: 0 }))
        if (offset < 0) {
          step(world, command(Button.Dodge))
          expect(player.cooldowns.dodge).toBe(0)
          expect(player.action).toBeNull()
        }
      }
    })

    it('does not repeat a held dodge; a released fresh press starts another', () => {
      const { world, player } = fixture(build())
      const held = command(Button.Dodge)
      const events = advance(world, world.content.dodge.cooldownTicks * 3, held)
      expect(events.filter(event => event.type === 'dodge')).toHaveLength(1)
      expect(player.action).toBeNull()
      expect(player.previousButtons).toBe(Button.Dodge)
      step(world, command())
      const next = world.tick + 1
      expect(step(world, held)).toContainEqual(expect.objectContaining({ type: 'dodge', actorId: player.id, tick: next }))
    })
  })

  it.each([['windup', 1, true], ['active', 2, false], ['recovery', 4, true]] as const)('arbitrates dodge during %s without buffering blocked edges', (_phase, age, allowed) => {
    const { world, player } = fixture()
    step(world, command(Button.Primary))
    advance(world, age - 1)
    step(world, command(Button.Dodge))
    expect(player.action?.id).toBe(allowed ? 'dodge' : 'fixture-melee')
    if (!allowed) {
      advance(world, 20, command(Button.Dodge))
      expect(player.action).toBeNull()
    }
  })

  it.each([5, 6, 7])('roots approved recovery until its exact movement cancellation offset %i', offset => {
    const { world, player } = fixture(m1Content(), { skills: { primary: 'span-cut', secondary: 'fold-dart' } })
    step(world, command(Button.Primary))
    advance(world, 9 + offset - 1)
    step(world, command(0, { x: 1, z: 0 }))
    expect(player.action).toEqual(offset < 6 ? expect.objectContaining({ id: 'span-cut', ageTicks: 9 + offset }) : null)
    expect(player.pos.x > 0).toBe(offset >= 6)
  })

  it('roots windup/active and lets held attacks repeat exactly at completion', () => {
    const { world, player } = fixture()
    const held = command(Button.Primary | Button.Secondary, { x: 1, z: 0 })
    advance(world, 4, held)
    expect(player.action).toMatchObject({ id: 'fixture-melee', startTick: 1, ageTicks: 3 })
    expect(player.pos).toEqual({ x: 0, z: 0 })
    advance(world, 4, command(Button.Primary | Button.Secondary))
    expect(player.action).toMatchObject({ id: 'fixture-melee', startTick: 8, ageTicks: 0 })
  })

  it('gives dodge precedence and skips unavailable primary slots', () => {
    const first = fixture()
    step(first.world, command(Button.Primary | Button.Secondary | Button.Dodge))
    expect(first.player.action?.id).toBe('dodge')
    const second = fixture(undefined, { cooldowns: { primary: 5, secondary: 0, dodge: 0 } })
    step(second.world, command(Button.Primary | Button.Secondary))
    expect(second.player.action?.id).toBe('fixture-projectile')
  })
})
