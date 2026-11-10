import { hashWorld } from './hash'
import { step } from './loop'
import { restore } from './snapshot'
import type { Replay } from './types'

/** Re-simulate without mutating the replay, returning the first mismatching hash tick. */
export function verifyReplay(replay: Replay): { ok: boolean; divergedAt?: number } {
  if (replay.format !== 'folio.arpg.replay' || !Array.isArray(replay.commands) || !Array.isArray(replay.hashes)) throw new TypeError('Invalid replay')
  const world = restore(JSON.stringify(replay.start))
  const end = world.tick + replay.commands.length
  let previous = world.tick - 1
  for (const [tick, hash] of replay.hashes) {
    if (!Number.isSafeInteger(tick) || tick <= previous || tick > end || typeof hash !== 'string') throw new TypeError('Invalid replay hash order or range')
    previous = tick
  }
  let index = 0
  for (let command = 0; command <= replay.commands.length; command++) {
    if (replay.hashes[index]?.[0] === world.tick) {
      if (hashWorld(world) !== replay.hashes[index]![1]) return { ok: false, divergedAt: world.tick }
      index++
    }
    if (command < replay.commands.length) step(world, replay.commands[command]!)
  }
  return { ok: true }
}
