import { expect, it } from 'vitest'
import { arena, command, damage, playerOf, run, tap, target } from '../../acceptance/m3a/fixtures'
import { Button, restore, serialize, step } from '../../core'

it('Fold Dart passes a target killed by Lay Bed earlier in the same sweep', () => {
  const world = arena('hearth-frame')
  tap(world, Button.Primary, 24, { x: 1.2, z: 0 })
  tap(world, Button.Skill1, 15)
  // Both enemies enter the next dart sweep. Only the front enemy is on the armed tile.
  const front = target(world, 2.08, 0, { health: 1 })
  const rear = target(world, 2.21)
  const hits = damage(step(world, command()))
  expect(front.health).toBe(0)
  expect(hits.map(hit => [hit.skillId, hit.targetId])).toEqual([['lay-bed', front.id], ['fold-dart', rear.id]])
  expect(world.projectiles).toHaveLength(0)
})

it('a distant Cast Loop hit pauses its target and allows a ready Dodge on the next tick', () => {
  const world = arena('verge-reel'), enemy = target(world, 4)
  world.content.m3!.actions.find(a => a.id === 'cast-loop')!.impactPauseTicks = 2
  tap(world, Button.Primary, 26)
  expect(playerOf(world).action).toBeNull()
  expect(damage(step(world, command()), enemy.id)).toMatchObject([{ skillId: 'cast-loop' }])
  expect(enemy.impactPauseTicks).toBe(2)
  expect(step(world, command(Button.Dodge))).toContainEqual(expect.objectContaining({ type: 'dodge' }))
})

it('holding Rill Fan across encounter start requires a fresh press to channel', () => {
  const world = arena(), player = playerOf(world), fan = Button.Skill2
  world.encounter!.phase = 'rest'
  step(world, command(fan))
  const start = step(world, { ...command(fan | Button.Dodge), operations: [{ type: 'beginEncounter' }] })
  expect(start).toContainEqual(expect.objectContaining({ type: 'operationAccepted' }))
  expect(player.action).toBeNull()
  step(world, command(fan))
  expect(player.action).toBeNull()
  step(world, command())
  step(world, command(fan))
  expect(player.mechanics!.held?.skillId).toBe('rill-fan')
})

it('a grazing Fold Dart knocks the target along its eastbound flight', () => {
  const world = arena(), enemy = target(world, 2, .13)
  world.content.m3!.actions.find(a => a.id === 'fold-dart')!.knockback = { speed: 6, ticks: 4 }
  expect(damage(tap(world, Button.Skill1, 16), enemy.id)).toMatchObject([{ skillId: 'fold-dart' }])
  expect(enemy.knockback?.vel).toEqual({ x: 6, z: 0 })
})

it.each(['missing', 'duplicate', 'wrong action group'])('restore rejects a held Plinth Blow with a %s charge effect', fault => {
  const world = arena('plumbshoe')
  run(world, 24, command(Button.Primary))
  const saved = serialize(world)
  expect(serialize(restore(saved))).toBe(saved)
  const charge = world.effects!.find(e => e.kind === 'counter')!
  if (fault === 'missing') world.effects = []
  if (fault === 'duplicate') world.effects!.push({ ...charge, id: world.nextId++ })
  if (fault === 'wrong action group') charge.groupId = 'other-charge'
  expect(() => restore(serialize(world))).toThrow(/charge/)
})
