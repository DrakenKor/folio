import { hashWorld, Recorder, restore, serialize, step } from '../core'
import { Button } from '../core/types'
import type { Command, Entity, Replay, SimEvent, SnapshotEnvelope, World } from '../core/types'
import { command, fixture, m1Content, projectile, target } from './fixtures'

/** Preplaced normal-health trios avoid requiring T1.5 wave spawning during replay. */
export function fightFixture() {
  const { world, player } = fixture(m1Content(), { pos: { x: -1.2, z: 0 } })
  const groups: Entity[][] = []
  for (let group = 0; group < 12; group++) {
    groups.push([0, 1.2, -1.2].map(z => target(world, { x: group * 10, z })))
  }
  const owner = groups[0]![0]!
  for (const x of [-2.3, -3]) projectile(world, owner, { pos: { x, z: 0 } })
  restore(serialize(world))
  return { world, player, groups }
}

/** One consumed command per tick; observations choose inputs, never change world data. */
export function fightCommand(world: World, groups: Entity[][]): Command {
  if (world.tick >= 7200) return command(0, undefined, null)
  const player = world.entities.find(actor => actor.id === world.playerId)!
  const local = world.tick % 600
  const victim = groups[Math.floor(world.tick / 600)]!.find(actor => actor.health > 0)
  if (local === 520) return command(Button.Dodge, undefined, { x: player.pos.x + 10, z: player.pos.z })
  if (!victim) return command(0, undefined, null)
  const dx = victim.pos.x - player.pos.x
  const dz = victim.pos.z - player.pos.z
  const distance = Math.sqrt(dx * dx + dz * dz)
  if (distance > 1.25) return command(0, { x: dx / distance, z: dz / distance }, { ...victim.pos })
  return command(local % 90 < 45 ? Button.Primary : Button.Secondary, undefined, { ...victim.pos })
}

export function recordFight() {
  const { world, player, groups } = fightFixture()
  const start = JSON.parse(serialize(world)) as SnapshotEnvelope
  const recorder = new Recorder(world)
  const full: Replay = { format: 'folio.arpg.replay', start, commands: [], hashes: [[0, hashWorld(world)]] }
  const events: SimEvent[] = []
  let sawPause = false
  let sawKnockback = false
  while (world.tick < 7200) {
    const input = fightCommand(world, groups)
    events.push(...step(world, input))
    recorder.record(input)
    full.commands.push(input)
    if (world.tick % 60 === 0) full.hashes.push([world.tick, hashWorld(world)])
    sawPause ||= world.entities.some(actor => actor.impactPauseTicks > 0)
    sawKnockback ||= world.entities.some(actor => actor.knockback !== null)
  }
  const finalHash = hashWorld(world)
  const rotatedAt7200 = recorder.exportReplay()
  while (world.tick < 9007) {
    const input = fightCommand(world, groups)
    events.push(...step(world, input))
    recorder.record(input)
  }
  return { full, finalHash, events, sawPause, sawKnockback, playerId: player.id, finalHealth: player.health, rotatedAt7200, retained: recorder.exportReplay(), retainedFinalHash: hashWorld(world) }
}
