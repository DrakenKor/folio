import { hashWorld } from './hash'
import { restore, serialize } from './snapshot'
import { BUTTON_MASK, EQUIPMENT_ROLES } from './types'
import type { Command, Operation, Replay, World } from './types'

export type { Command } from './types'
export { Button, IDLE_COMMAND } from './types'

/** Check structure only; semantic rejection is a recorded operation result. */
export function validateOperation(operation: Operation): void {
  const text = (value: unknown) => typeof value === 'string' && value.length > 0
  const item = (value: number) => Number.isSafeInteger(value) && value > 0
  const store = (value: string) => value === 'inventory' || value === 'stash'
  const texts = (values: string[]) => Array.isArray(values) && Array.from(values).every(text)
  let valid = !!operation && typeof operation === 'object' && !Array.isArray(operation)
  if (valid) switch (operation.type) {
    case 'allocate': case 'refund': valid = text(operation.nodeId); break
    case 'activateShape': valid = text(operation.shapeId) && typeof operation.active === 'boolean'; break
    case 'equip': case 'pickup': valid = item(operation.itemId); break
    case 'unequip': valid = EQUIPMENT_ROLES.includes(operation.role); break
    case 'setLoadout': valid = Array.isArray(operation.slots) && operation.slots.length === 6 && Array.from(operation.slots).every(slot => slot === null || text(slot)); break
    case 'setFolds': valid = text(operation.skillId) && texts(operation.foldIds); break
    case 'stash': case 'discard': valid = item(operation.itemId) && store(operation.from); break
    case 'beginEncounter': case 'returnToShelter': break
    default: valid = false
  }
  if (!valid) throw new TypeError('Invalid command operation')
  // Only declared fields enter recordings, events or hooks.
  const fields: Record<Operation['type'], string[]> = {
    allocate: ['nodeId'], refund: ['nodeId'], activateShape: ['shapeId', 'active'], equip: ['itemId'], unequip: ['role'],
    setLoadout: ['slots'], setFolds: ['skillId', 'foldIds'], pickup: ['itemId'], stash: ['itemId', 'from'], discard: ['itemId', 'from'],
    beginEncounter: [], returnToShelter: []
  }
  if (Object.keys(operation).some(key => key !== 'type' && !fields[operation.type].includes(key))) throw new TypeError('Invalid command operation field')
}

/** Reject malformed input before it can change simulation state. */
export function validateCommand(command: Command): void {
  if (!command || !command.move || !Number.isFinite(command.move.x) || !Number.isFinite(command.move.z) ||
    !Number.isSafeInteger(command.buttons) || command.buttons < 0 || command.buttons > BUTTON_MASK ||
    (command.aim !== null && (!command.aim || !Number.isFinite(command.aim.x) || !Number.isFinite(command.aim.z)))) throw new TypeError('Invalid command')
  if (command.operations !== undefined) {
    if (!Array.isArray(command.operations)) throw new TypeError('Invalid command operations')
    for (const operation of command.operations) validateOperation(operation)
  }
}

/** Detach an input before keeping it as replay data. */
export function copyCommand(command: Command): Command {
  validateCommand(command)
  // JSON erases signed zero, which otherwise changes atan2 on the west axis.
  return { move: { x: command.move.x || 0, z: command.move.z || 0 }, aim: command.aim ? { x: command.aim.x || 0, z: command.aim.z || 0 } : null,
    buttons: command.buttons, ...(command.operations === undefined ? {} : { operations: structuredClone(command.operations) }) }
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
