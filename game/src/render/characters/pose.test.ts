import { describe, expect, it } from 'vitest'
import { restore, serialize, step } from '../../sim/core'
import { Button, IDLE_COMMAND } from '../../sim/core/types'
import { combatSnapshot } from '../../anim/fixture'
import { previewState } from '../../anim/preview'
import { CLIP_MARKERS, CLIP_NAMES } from './markers'
import { actionClip, actionTime, actorPoseState, characterPose } from './pose'

describe('snapshot-driven character pose', () => {
  it('is deterministic for every state and preview variant', () => {
    for (const clip of CLIP_NAMES) {
      const state = previewState(clip, 3)
      const before = JSON.stringify(state)
      expect(characterPose(state, 0.4)).toEqual(characterPose(structuredClone(state), 0.4))
      expect(JSON.stringify(state)).toBe(before)
    }
  })

  it('maps phase boundary ages to measured contact, recovery and end markers', () => {
    for (const clip of ['attack', 'attack_slice', 'attack_stab', 'cast', 'cast_long', 'dodge'] as const) {
      const timing = previewState(clip, 0).timing!
      const w = timing.windupTicks, a = timing.activeTicks, r = timing.recoveryTicks
      expect(actionTime(clip, timing, w)).toBe(CLIP_MARKERS[clip].contact)
      expect(actionTime(clip, timing, w + a)).toBe(CLIP_MARKERS[clip].recovery)
      expect(actionTime(clip, timing, w + a + r)).toBe(CLIP_MARKERS[clip].end)
      if (w) expect(actionTime(clip, timing, 0)).toBe(0)
    }
    expect(actionTime('attack', { windupTicks: 0, activeTicks: 1, recoveryTicks: 0, moveCancelTicks: 0 }, 1)).toBe(CLIP_MARKERS.attack.end)
  })

  it('preserves variants, weights and absolute times through snapshot restore', () => {
    const world = restore(combatSnapshot())
    for (let tick = 0; tick < 40; tick++) {
      step(world, { move: { x: 0, z: 0 }, aim: { x: 100, z: 0 }, buttons: Button.Primary })
      const copy = restore(serialize(world))
      const actor = world.entities[0]!, copied = copy.entities[0]!
      expect(characterPose(actorPoseState(actor, world))).toEqual(characterPose(actorPoseState(copied, copy)))
      if (actor.action) expect(actionClip(actor.id, actor.action)).toBe(actionClip(copied.id, copied.action!))
    }
  })

  it('retains identical poses through rendered, skipped and restored continuations', () => {
    const world = restore(combatSnapshot())
    world.entities[1]!.pos = { x: 20, z: 20 }
    const copy = restore(serialize(world))
    for (let i = 0; i < 100; i++) {
      const command = { ...IDLE_COMMAND, move: { x: 1, z: 0 }, buttons: i > 40 && i < 60 ? Button.Primary : 0 }
      step(world, command)
      step(copy, command)
      for (const alpha of [0.1, 0.5, 0.9]) characterPose(actorPoseState(world.entities[0]!, world), alpha)
      expect(characterPose(actorPoseState(world.entities[0]!, world))).toEqual(characterPose(actorPoseState(copy.entities[0]!, copy)))
    }
  })

  it('freezes paused ages and gait; alpha zero and new identities use current state', () => {
    const state = previewState('attack', 6)
    const previous = structuredClone(state.actor)
    previous.action!.ageTicks = 5
    previous.gait.phase = -1
    state.previous = previous
    expect(characterPose(state, 0).clips.attack![1]).toBe(CLIP_MARKERS.attack.contact)
    state.actor = { ...state.actor, impactPauseTicks: 2 }
    expect(characterPose(state, 0.1)).toEqual(characterPose(state, 0.9))
    state.actor = { ...state.actor, impactPauseTicks: 0 }
    previous.action!.startTick++
    expect(characterPose(state, 0.5).clips.attack![1]).toBe(CLIP_MARKERS.attack.contact)
    state.previous = { ...previous, id: previous.id + 1 }
    expect(characterPose(state, 0.5)).toEqual(characterPose({ ...state, previous: undefined }, 0.5))
  })

  it('holds death at the terminal frame and keeps weights normalized', () => {
    expect(characterPose(previewState('death', 1000)).clips).toEqual({ death: [1, CLIP_MARKERS.death.end] })
    for (const clip of CLIP_NAMES) {
      for (const age of [0, 1, 3, 5]) {
        const pose = characterPose(previewState(clip, age))
        expect(Object.values(pose.clips).reduce((sum, sample) => sum + sample![0], 0)).toBeCloseTo(1)
      }
    }
  })
})
