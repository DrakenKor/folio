import { describe, expect, it } from 'vitest'
import { createWorld, hashWorld, spawnEntity, verifyReplay } from '../sim/core/index'
import { Clock } from './clock'

function movingClock() {
  const world = createWorld(7)
  spawnEntity(world, { kind: 'player', pos: { x: 0, z: 0 }, radius: 0.4 })
  return new Clock(world, () => ({ move: { x: 1, z: 0 }, aim: null, buttons: 0 }))
}

describe('browser clock', () => {
  it('accumulates 60 Hz steps, preserves previous poses, and drops excess catch-up', () => {
    const clock = movingClock()
    clock.frame(0)
    expect(clock.frame(8).world.tick).toBe(0)
    const frame = clock.frame(25)
    expect(frame.world.tick).toBe(1)
    expect(frame.prev.get(1)?.x).toBe(0)
    expect(frame.alpha).toBeCloseTo(0.5)
    expect(clock.frame(1025).world.tick).toBe(5)
    expect(clock.frame(1026).world.tick).toBe(5)
    expect(verifyReplay(clock.recorder.exportReplay())).toEqual({ ok: true })
  })

  it('keeps explicit pause across focus changes and discards suspended wall time', () => {
    const clock = movingClock()
    clock.frame(0)
    clock.suspend('hidden', true)
    clock.suspend('blur', true)
    clock.frame(10000)
    expect(clock.world.tick).toBe(0)
    clock.pause()
    clock.suspend('hidden', false)
    clock.suspend('blur', false)
    expect(clock.paused).toBe(true)
    clock.advance(2)
    expect(clock.world.tick).toBe(2)
    clock.resume()
    clock.frame(20000)
    expect(clock.world.tick).toBe(2)
    clock.frame(20017)
    expect(clock.world.tick).toBe(3)
  })

  it('resets interpolation and the recorder when the world changes', () => {
    const clock = movingClock()
    clock.advance(10)
    const world = createWorld(9)
    clock.replace(world)
    expect(clock.frame(1000).prev.size).toBe(0)
    const replay = clock.recorder.exportReplay()
    expect(replay.commands).toEqual([])
    expect(replay.hashes).toEqual([[0, hashWorld(world)]])
  })
})
