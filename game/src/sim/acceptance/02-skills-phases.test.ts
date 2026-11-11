import { describe, expect, it } from 'vitest'
import { restore, serialize, step } from '../core'
import { Button } from '../core/types'
import { advance, command, contentCases, fixture, m1Content, projectile, target } from './fixtures'

describe('2: skills and phase boundaries', () => {
  for (const { name, build } of contentCases) {
    const content = build()
    const actions = [...content.skills.map(skill => ({ id: skill.id, timing: skill.timing })), { id: 'dodge', timing: content.dodge.timing }]
    for (const { id, timing } of actions) {
      const boundaries = [0, timing.windupTicks, timing.windupTicks + timing.activeTicks, timing.windupTicks + timing.activeTicks + timing.recoveryTicks]
      const ages = [...new Set(boundaries.flatMap(boundary => [boundary - 1, boundary, boundary + 1]))].sort((a, b) => a - b)
      it.each(ages)(`${name} ${id} processes boundary probe age %i`, age => {
        const { world, player } = fixture(build(), { skills: { primary: id === 'dodge' ? null : id, secondary: null } })
        if (age >= 0) {
          step(world, command(id === 'dodge' ? Button.Dodge : Button.Primary))
          advance(world, age)
        }
        if (age < 0 || age >= boundaries[3]!) {
          expect(player.action).toBeNull()
        } else {
          expect(player.action).toMatchObject({ id, startTick: 1, ageTicks: age, direction: 0 })
          const kind = content.skills.find(skill => skill.id === id)?.kind
          if (kind === 'projectile') {
            expect(player.action?.projectileSpawned).toBe(age >= timing.windupTicks)
          }
        }
        expect(world.tick).toBe(age < 0 ? 0 : age + 1)
        expect(() => restore(serialize(world))).not.toThrow()
      })
    }
  }

  for (const { name, build } of contentCases) {
    for (const skill of build().skills.filter(value => value.kind === 'melee')) {
      const { windupTicks: w, activeTicks: a, recoveryTicks: r } = skill.timing
      const ages = [...new Set([0, w - 1, w, ...Array.from({ length: a }, (_, index) => w + index), w + a, w + a + 1, w + a + r - 1])]
      it.each(ages)(`${name} ${skill.id} allows melee damage only at an active age, probe %i`, age => {
        const { world, player } = fixture(build(), { skills: { primary: skill.id, secondary: null } })
        if (age > 0) {
          step(world, command(Button.Primary))
          advance(world, age - 1)
        }
        const victim = target(world)
        const events = step(world, command(age === 0 ? Button.Primary : 0))
        expect(player.action).toMatchObject({ id: skill.id, ageTicks: age })
        expect(victim.health).toBe(age >= w && age < w + a ? 72 - skill.damage : 72)
        expect(events.filter(event => event.type === 'damage')).toHaveLength(age >= w && age < w + a ? 1 : 0)
      })
    }
  }

  it('hits each hostile once across active frames and begins fresh deduplication for another action', () => {
    const { world, player } = fixture()
    const first = target(world, { x: 1.2, z: -0.5 })
    const second = target(world, { x: 1.2, z: 0.5 })
    const events = advance(world, 4, command(Button.Primary))
    expect(events.filter(event => event.type === 'damage').map(event => event.targetId)).toEqual([first.id, second.id])
    expect(player.action?.hitTargetIds).toEqual([first.id, second.id])
    expect([first.health, second.health]).toEqual([65, 65])
    advance(world, 6, command(Button.Primary))
    expect([first.health, second.health]).toEqual([58, 58])
  })

  it('misses outside the sector and excludes friendly targets', () => {
    const { world, player } = fixture()
    const outside = target(world, { x: 4, z: 0 })
    const behind = target(world, { x: -1.2, z: 0 })
    const friendly = target(world, { x: 1.2, z: 0 }, { faction: player.faction })
    advance(world, 4, command(Button.Primary))
    expect(player.action?.hitTargetIds).toEqual([])
    expect([outside.health, behind.health, friendly.health]).toEqual([72, 72, 72])
  })

  it.each(['range', 'arc'] as const)('includes hostile circle overlap at the %s boundary', boundary => {
    const { world } = fixture()
    const victim = target(world, boundary === 'range' ? { x: 2.25, z: 0 } : { x: 1, z: 1.25 }, { radius: 0.25 })
    advance(world, 3, command(Button.Primary))
    expect(victim.health).toBe(65)
  })

  it('launches once at first active age and sweeps immediately without windup/recovery launches', () => {
    const { world, player } = fixture()
    step(world, command(Button.Secondary))
    expect(player.action).toMatchObject({ kind: 'projectile', ageTicks: 0, projectileSpawned: false })
    expect(world.projectiles).toHaveLength(0)
    step(world, command())
    expect(world.projectiles).toHaveLength(0)
    step(world, command())
    expect(world.projectiles).toHaveLength(1)
    const shot = world.projectiles[0]!
    expect(shot).toMatchObject({ ownerId: player.id, ageTicks: 0, actionStartTick: 1, pos: { x: 0.5, z: 0 } })
    expect(player.action?.projectileSpawned).toBe(true)
    advance(world, 4)
    expect(world.projectiles.map(value => value.id)).toEqual([shot.id])
    expect(shot.ageTicks).toBe(4)
  })

  it.each(contentCases)('$name projectile allows exactly L sweeps before expiry', ({ build }) => {
    const { world } = fixture(build())
    const skill = world.content.skills.find(value => value.kind === 'projectile')!
    step(world, command(Button.Secondary))
    advance(world, skill.timing.windupTicks)
    expect(world.projectiles).toHaveLength(1)
    const launch = { ...world.projectiles[0]!.pos }
    const shot = world.projectiles[0]!
    advance(world, shot.lifetimeTicks - 1)
    expect(world.projectiles).toHaveLength(1)
    expect(shot.ageTicks).toBe(shot.lifetimeTicks - 1)
    expect(shot.pos.x - launch.x).toBeCloseTo(shot.vel.x * (shot.lifetimeTicks - 1) / 60, 8)
    expect(shot.pos.x).toBeCloseTo(shot.vel.x * shot.lifetimeTicks / 60, 8)
    step(world, command())
    expect(world.projectiles).toEqual([])
    step(world, command())
    expect(world.projectiles).toEqual([])
  })

  it('consumes one hostile contact and ignores owner, friendly and off-path actors', () => {
    const { world, player } = fixture()
    const friendly = target(world, { x: 0.7, z: 0 }, { radius: 0.1, faction: player.faction })
    const first = target(world, { x: 1.5, z: 0 }, { radius: 0.1 })
    const next = target(world, { x: 2.5, z: 0 }, { radius: 0.1 })
    const miss = target(world, { x: 1.5, z: 1.5 }, { radius: 0.1 })
    projectile(world, player, { pos: { x: 0, z: 0 }, vel: { x: 240, z: 0 } })
    const events = advance(world, 3)
    expect(events.filter(event => event.type === 'damage').map(event => event.targetId)).toEqual([first.id])
    expect([player.health, friendly.health, first.health, next.health, miss.health]).toEqual([120, 72, 67, 72, 72])
    expect(world.projectiles).toEqual([])
  })

  it.each([['span-cut', 3, Button.Primary, 24], ['fold-dart', 5, Button.Secondary, 16], ['creaseback-strike', 6, Button.Primary, 20]] as const)('%s kills a normal target in %i confirmed hits', (id, hits, button, damage) => {
    const { world } = fixture(m1Content(), { skills: { primary: id === 'creaseback-strike' ? id : 'span-cut', secondary: 'fold-dart' } })
    const health = id === 'creaseback-strike' ? 120 : 72
    const victim = target(world, { x: id === 'creaseback-strike' ? 0.8 : 1.2, z: 0 }, { maxHealth: health, health })
    const events = advance(world, 400, command(button))
    const damages = events.filter(event => event.type === 'damage').filter(event => event.targetId === victim.id)
    expect(damages).toHaveLength(hits)
    expect(damages.map(event => event.skillId)).toEqual(Array(hits).fill(id))
    expect(damages.slice(0, -1).map(event => event.amount)).toEqual(Array(hits - 1).fill(damage))
    expect(victim.health).toBe(0)
    expect(events.filter(event => event.type === 'death' && event.targetId === victim.id)).toHaveLength(1)
  })
})
