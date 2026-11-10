import { moveEntities } from '../systems/movement'
import { wanderDummies } from '../systems/wandering-dummy'
import { validateCommand } from './commands'
import type { Command, SimEvent, World } from './types'

/** Consume one command and advance exactly one 60 Hz tick. */
export function step(world: World, command: Command): SimEvent[] {
  validateCommand(command)
  wanderDummies(world)
  moveEntities(world, command)
  world.tick++
  return []
}
