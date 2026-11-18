// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { IDLE_COMMAND, serialize, step } from '../../sim/core'
import { fixture, m1Content, projectile, target } from '../../sim/acceptance/fixtures'
import type { Heightfield } from '../terrain/heightfield'
import { CombatFeedback } from './feedback'

afterEach(() => vi.restoreAllMocks())

it('shows each simultaneous Fold Dart damage once, including when the frame is synced again', () => {
  const text = vi.fn()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ strokeText() {}, fillText: text } as unknown as CanvasRenderingContext2D)
  const feedback = new CombatFeedback({ player: { x: 0, z: 0 }, heightAt: () => 0 } as unknown as Heightfield)
  const { world, player } = fixture(m1Content())
  const victim = target(world)
  projectile(world, player, { pos: { x: 0.7, z: 0 } })
  projectile(world, player, { pos: { x: 0.7, z: 0 } })
  const events = step(world, IDLE_COMMAND)
  const frame = { world, prev: new Map(), alpha: 0, events }
  const snapshot = serialize(world)
  try {
    expect(events.filter(event => event.type === 'damage')).toHaveLength(2)
    expect(victim.health).toBe(40)
    feedback.sync(frame)
    const numbers = () => feedback.object.children.flatMap(group => group.children).filter(child => child.type === 'Sprite')
    expect(numbers()).toHaveLength(2)
    expect(text.mock.calls.map(call => call[0])).toEqual(['16', '16'])
    feedback.sync(frame)
    expect(numbers()).toHaveLength(2)
    expect(text).toHaveBeenCalledTimes(2)
    world.tick += 30
    feedback.sync({ ...frame, events: [] })
    expect(numbers()).toHaveLength(0)
    world.tick -= 30
    expect(serialize(world)).toBe(snapshot)
  } finally { feedback.dispose() }
})
