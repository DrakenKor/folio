import { hashWorld } from './hash'
import { restore, serialize } from './snapshot'
import { BUTTON_MASK } from './types'
import type { Command, Replay, World } from './types'

export type { Command } from './types'
export { Button, IDLE_COMMAND } from './types'

/** Reject malformed input before it can change simulation state. */
export function validateCommand(command: Command): void {
  if (!command || !command.move || !Number.isFinite(command.move.x) || !Number.isFinite(command.move.z) ||
    !Number.isSafeInteger(command.buttons) || command.buttons < 0 || command.buttons > BUTTON_MASK ||
    (command.aim !== null && (!command.aim || !Number.isFinite(command.aim.x) || !Number.isFinite(command.aim.z)))) throw new TypeError('Invalid command')
}

/** Detach an input before keeping it as replay data. */
export function copyCommand(command: Command): Command {
  validateCommand(command)
  return { move: { x: command.move.x, z: command.move.z }, aim: command.aim ? { x: command.aim.x, z: command.aim.z } : null, buttons: command.buttons }
}

interface Checkpoint { tick: number; text: string }

/** Records after each step; reset with the replacement world after any discontinuity. */
export class Recorder {
  private world!: World
  private checkpoints: Checkpoint[] = []
  private commands: Command[] = []
  private hashes: Array<[number, string]> = []
  private lastTick = 0

  constructor(world: World) { this.reset(world) }

  reset(world: World): void {
    this.world = world
    this.lastTick = world.tick
    this.checkpoints = [{ tick: world.tick, text: serialize(world) }]
    this.commands = []
    this.hashes = [[world.tick, hashWorld(world)]]
  }

  record(command: Command): void {
    if (this.world.tick !== this.lastTick + 1) throw new Error('Call record once after each step; reset after restoring or changing worlds')
    this.commands.push(copyCommand(command))
    this.lastTick = this.world.tick
    if (this.lastTick % 60 === 0) this.hashes.push([this.lastTick, hashWorld(this.world)])
    if (this.lastTick - this.checkpoints[this.checkpoints.length - 1]!.tick === 1800) {
      this.checkpoints.push({ tick: this.lastTick, text: serialize(this.world) })
      if (this.checkpoints.length > 3) {
        const oldStart = this.checkpoints.shift()!.tick
        const newStart = this.checkpoints[0]!.tick
        this.commands.splice(0, newStart - oldStart)
        this.hashes = this.hashes.filter(([tick]) => tick >= newStart)
      }
    }
  }

  exportReplay(): Replay {
    if (this.world.tick !== this.lastTick) throw new Error('Record the current tick before exporting')
    const checkpoint = this.checkpoints.findLast(point => point.tick <= this.lastTick - 3600) ?? this.checkpoints[0]!
    const start = restore(checkpoint.text)
    const hashes = this.hashes.filter(([tick]) => tick >= checkpoint.tick).map(([tick, hash]): [number, string] => [tick, hash])
    if (hashes[0]?.[0] !== start.tick) hashes.unshift([start.tick, hashWorld(start)])
    // Include the current boundary too, so partial seconds are verifiable.
    if (hashes[hashes.length - 1]?.[0] !== this.lastTick) hashes.push([this.lastTick, hashWorld(this.world)])
    return {
      format: 'folio.arpg.replay',
      start: { format: 'folio.arpg.snapshot', schema: start.schema, build: start.build, world: start },
      commands: this.commands.slice(checkpoint.tick - this.checkpoints[0]!.tick).map(copyCommand),
      hashes
    }
  }
}
