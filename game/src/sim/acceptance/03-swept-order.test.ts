import { describe, expect, it } from 'vitest'
import { step } from '../core'
import { Button } from '../core/types'
import { advance, command, fixture, projectile, target } from './fixtures'

describe('3: swept contacts and ordering', () => {
  it('hits a small target between fast projectile endpoints', () => {
    const { world, player } = fixture()
    const victim = target(world, { x: 2, z: 0 }, { radius: 0.1 })
    projectile(world, player, { vel: { x: 240, z: 0 } })
    const events = step(world, command())
    expect(victim.health).toBe(67)
    expect(events).toContainEqual(expect.objectContaining({ type: 'hit', actorId: player.id, targetId: victim.id }))
    expect(world.projectiles).toEqual([])
  })

  it('chooses earliest travel fraction even when the farther target has a lower id', () => {
    const { world, player } = fixture()
    const far = target(world, { x: 3, z: 0 }, { radius: 0.1 })
    const near = target(world, { x: 1.2, z: 0 }, { radius: 0.1 })
    projectile(world, player, { vel: { x: 240, z: 0 } })
    expect(step(world, command()).filter(event => event.type === 'hit').map(event => event.targetId)).toEqual([near.id])
    expect([far.health, near.health]).toEqual([72, 67])
  })

  it('breaks equal-fraction target ties by entity id', () => {
    const { world, player } = fixture()
    const low = target(world, { x: 2, z: -0.3 }, { radius: 0.1 })
    const high = target(world, { x: 2, z: 0.3 }, { radius: 0.1 })
    projectile(world, player, { vel: { x: 240, z: 0 }, radius: 0.4 })
    expect(step(world, command()).filter(event => event.type === 'hit').map(event => event.targetId)).toEqual([low.id])
    expect([low.health, high.health]).toEqual([67, 72])
  })

  it('sorts simultaneous contacts by fraction, target, actor and projectile ids', () => {
    const { world, player } = fixture(undefined, { pos: { x: -20, z: 0 } })
    const lowOwner = target(world, { x: -10, z: -5 }, { faction: player.faction })
    const highOwner = target(world, { x: -10, z: 5 }, { faction: player.faction })
    const lowTarget = target(world, { x: 3, z: 0 }, { radius: 0.1 })
    const highTarget = target(world, { x: 3, z: 3 }, { radius: 0.1 })
    const common = { pos: { x: 0, z: 0 }, vel: { x: 240, z: 0 } }
    const highActorShot = projectile(world, highOwner, structuredClone(common))
    const lowActorShot = projectile(world, lowOwner, structuredClone(common))
    const sameActorShot = projectile(world, lowOwner, structuredClone(common))
    const earliest = projectile(world, highOwner, { ...structuredClone(common), pos: { x: 2, z: 3 } })
    const hits = step(world, command()).filter(event => event.type === 'hit')
    expect(hits.map(event => [event.targetId, event.actorId, event.projectileId])).toEqual([
      [highTarget.id, highOwner.id, earliest.id],
      [lowTarget.id, lowOwner.id, lowActorShot.id],
      [lowTarget.id, lowOwner.id, sameActorShot.id],
      [lowTarget.id, highOwner.id, highActorShot.id]
    ])
  })

  it('uses target id before source id for equal-fraction contacts', () => {
    const { world, player } = fixture(undefined, { pos: { x: -20, z: 0 } })
    const lowOwner = target(world, { x: -10, z: -5 }, { faction: player.faction })
    const highOwner = target(world, { x: -10, z: 5 }, { faction: player.faction })
    const lowTarget = target(world, { x: 3, z: 0 }, { radius: 0.1 })
    const highTarget = target(world, { x: 3, z: 3 }, { radius: 0.1 })
    projectile(world, lowOwner, { pos: { x: 0, z: 3 }, vel: { x: 240, z: 0 } })
    projectile(world, highOwner, { pos: { x: 0, z: 0 }, vel: { x: 240, z: 0 } })
    expect(step(world, command()).filter(event => event.type === 'hit').map(event => event.targetId)).toEqual([lowTarget.id, highTarget.id])
  })

  it('invalidates a later projectile contact when an earlier melee contact kills its owner', () => {
    const { world, player } = fixture()
    const source = target(world, { x: 1.2, z: 0 }, { health: 7 })
    advance(world, 2, command(Button.Primary))
    projectile(world, source, { pos: { x: -1, z: 0 }, vel: { x: 120, z: 0 } })
    const events = step(world, command())
    expect(source.health).toBe(0)
    expect(player.health).toBe(120)
    expect(events.filter(event => event.type === 'hit').map(event => event.actorId)).toEqual([player.id])
    expect(world.projectiles).toEqual([])
  })

  it('invalidates a later melee contact when its action is interrupted by an earlier contact', () => {
    const { world, player: first } = fixture()
    const controlled = target(world, { x: 1.2, z: 0 }, { kind: 'player', skills: { primary: 'fixture-melee', secondary: null } })
    first.kind = 'fixture-source'
    world.playerId = controlled.id
    world.tick = 2
    for (const actor of [first, controlled]) {
      actor.action = { id: 'fixture-melee', kind: 'melee', startTick: 1, ageTicks: 1, direction: actor === first ? 0 : Math.PI, hitTargetIds: [], projectileSpawned: false }
    }
    const events = step(world, command(0, undefined, { x: -100, z: 0 }))
    expect(first.health).toBe(113)
    expect(first.action).toBeNull()
    expect(controlled.health).toBe(72)
    expect(events.filter(event => event.type === 'damage').map(event => event.actorId)).toEqual([controlled.id])
  })
})
