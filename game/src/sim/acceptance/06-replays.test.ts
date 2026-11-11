import { beforeAll, describe, expect, it } from 'vitest'
import { hashWorld, restore, step, verifyReplay } from '../core'
import { Button } from '../core/types'
import { recordFight } from './fight-fixture'

let fight: ReturnType<typeof recordFight>
beforeAll(() => { fight = recordFight() }, 30_000)

describe('6: combat replay', () => {
  it('verifies every 60-tick hash and final hash across a real 7,200-tick fight', () => {
    expect.soft(fight.events.filter(event => event.type === 'damage').length).toBeGreaterThan(0)
    expect.soft(fight.events.some(event => event.type === 'damage' && event.targetId === fight.playerId)).toBe(true)
    for (const id of ['span-cut', 'fold-dart']) {
      expect.soft(fight.events.some(event => event.type === 'damage' && event.skillId === id && event.actorId === fight.playerId)).toBe(true)
    }
    expect.soft(fight.events.some(event => event.type === 'death')).toBe(true)
    expect.soft(fight.events.some(event => event.type === 'dodge')).toBe(true)
    expect.soft(fight.sawPause && fight.sawKnockback).toBe(true)
    expect(fight.finalHealth).toBeGreaterThan(0)
    expect(fight.full.commands).toHaveLength(7200)
    expect(fight.full.hashes.map(([tick]) => tick)).toEqual(Array.from({ length: 121 }, (_, index) => index * 60))
    expect(fight.full.hashes.at(-1)).toEqual([7200, fight.finalHash])
    expect(verifyReplay(fight.full)).toEqual({ ok: true })
    const replayed = restore(JSON.stringify(fight.full.start))
    for (const input of fight.full.commands) step(replayed, input)
    expect(hashWorld(replayed)).toBe(fight.finalHash)
  })

  it('reports the first affected periodic hash after removing combat input', () => {
    const changed = structuredClone(fight.full)
    expect(changed.commands[0]?.buttons).toBe(Button.Primary)
    const firstHash = 60
    for (let tick = 1; tick <= firstHash; tick++) changed.commands[tick - 1]!.buttons = 0

    const world = restore(JSON.stringify(changed.start))
    const hashes = new Map(changed.hashes)
    let firstMismatch: number | undefined
    for (const input of changed.commands) {
      step(world, input)
      if (hashes.has(world.tick) && hashWorld(world) !== hashes.get(world.tick)) {
        firstMismatch = world.tick
        break
      }
    }
    expect.soft(firstMismatch).toBe(firstHash)
    expect(verifyReplay(changed)).toEqual({ ok: false, divergedAt: firstHash })
  })

  it('verifies combat retained across checkpoint rotation and a partial final second', () => {
    expect.soft(fight.events.some(event => event.type === 'damage' && event.tick >= 5400)).toBe(true)
    expect(fight.rotatedAt7200.start.world.tick).toBe(3600)
    expect(fight.rotatedAt7200.commands).toHaveLength(3600)
    expect(verifyReplay(fight.rotatedAt7200)).toEqual({ ok: true })
    const replay = fight.retained
    expect(replay.start.world.tick).toBe(5400)
    expect(replay.commands).toHaveLength(3607)
    expect(replay.hashes.map(([tick]) => tick)).toEqual([
      ...Array.from({ length: 61 }, (_, index) => 5400 + index * 60), 9007
    ])
    expect(replay.hashes.at(-1)).toEqual([9007, fight.retainedFinalHash])
    expect(verifyReplay(replay)).toEqual({ ok: true })
    const world = restore(JSON.stringify(replay.start))
    for (const input of replay.commands) step(world, input)
    expect(hashWorld(world)).toBe(fight.retainedFinalHash)
  })
})
