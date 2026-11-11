import { selectAction } from '../combat/actions'
import { gatherContacts, launchProjectiles } from '../combat/contacts'
import { resolveContacts } from '../combat/damage'
import { validateCommand } from '../core/commands'
import type { Command, SimEvent, World } from '../core/types'
import { spawnFightWave } from '../scenarios'
import { advanceActors, beginActors } from '../systems/actors'
import { finalizeGait, moveEntities } from '../systems/movement'
import { wanderDummies } from '../systems/wandering-dummy'
import { driveEnemies } from './creaseback'

/** Integration adapter until the orchestrator wires AI and waves into core/loop.ts. */
export function stepEncounter(world: World, command: Command, scenario: string): SimEvent[] {
  validateCommand(command)
  world.tick++
  const events: SimEvent[] = []
  const states = beginActors(world, command)
  advanceActors(world, states, events)
  wanderDummies(world, states)
  driveEnemies(world, states)
  for (const actor of world.entities) selectAction(world, actor, states.get(actor.id)!, events)
  moveEntities(world, states)
  finalizeGait(world, states)
  const launched = launchProjectiles(world, states)
  const contacts = gatherContacts(world, states, launched)
  resolveContacts(world, contacts, launched, events)
  if (scenario === 'm1-fight') events.push(...spawnFightWave(world))
  return events
}
