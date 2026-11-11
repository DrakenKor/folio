import { selectAction } from '../combat/actions'
import { gatherContacts, launchProjectiles } from '../combat/contacts'
import { resolveContacts } from '../combat/damage'
import { advanceActors, beginActors } from '../systems/actors'
import { finalizeGait, moveEntities } from '../systems/movement'
import { wanderDummies } from '../systems/wandering-dummy'
import { validateCommand } from './commands'
import type { Command, SimEvent, World } from './types'

/** Consume one command and advance exactly one 60 Hz tick. */
export function step(world: World, command: Command): SimEvent[] {
  validateCommand(command)
  world.tick++
  const events: SimEvent[] = []
  const states = beginActors(world, command)
  advanceActors(world, states, events)
  wanderDummies(world, states)
  for (const actor of world.entities) selectAction(world, actor, states.get(actor.id)!, events)
  moveEntities(world, states)
  finalizeGait(world, states)
  const launched = launchProjectiles(world, states)
  const contacts = gatherContacts(world, states, launched)
  resolveContacts(world, contacts, launched, events)
  return events
}
