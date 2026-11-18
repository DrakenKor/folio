import { driveEnemies } from '../ai/creaseback'
import { selectAction } from '../combat/actions'
import { applyCombatOperation, processAilments } from '../combat/build'
import { gatherContacts, launchProjectiles } from '../combat/contacts'
import { resolveContacts } from '../combat/damage'
import { spawnFightWave } from '../scenarios'
import { applyProgressionOperation, processProgression } from '../progression'
import { advanceActors, beginActors } from '../systems/actors'
import { finalizeGait, moveEntities } from '../systems/movement'
import { wanderDummies } from '../systems/wandering-dummy'
import { copyCommand } from './commands'
import type { Command, SimEvent, World } from './types'
import { UnsupportedError } from './unsupported'

/** Consume one command and advance exactly one 60 Hz tick. */
export function step(world: World, command: Command): SimEvent[] {
  const input = copyCommand(command)
  world.tick++
  const events: SimEvent[] = []
  for (const [index, operation] of (input.operations ?? []).entries()) {
    const result = operation.type === 'setLoadout' || operation.type === 'setFolds' ?
      applyCombatOperation(world, operation) : applyProgressionOperation(world, operation)
    events.push(result.accepted ? { type: 'operationAccepted', tick: world.tick, index, operation, reason: result.reason } :
      { type: 'operationRejected', tick: world.tick, index, operation, reason: result.reason })
    if (result.accepted && (operation.type === 'beginEncounter' || operation.type === 'returnToShelter')) input.buttons = 0
  }
  const states = beginActors(world, input)
  advanceActors(world, states, events)
  const ailments = processAilments(world, events)
  if (!ailments.ok && world.ailments.length > 0) throw new UnsupportedError('ailment processing (T2.2)')
  wanderDummies(world, states)
  driveEnemies(world, states)
  for (const actor of world.entities) selectAction(world, actor, states.get(actor.id)!, events)
  moveEntities(world, states)
  finalizeGait(world, states)
  const launched = launchProjectiles(world, states)
  const contacts = gatherContacts(world, states, launched)
  resolveContacts(world, contacts, launched, events)
  // An unsupported progression hook awards nothing, so combat runs without progression.
  processProgression(world, events)
  if (world.scenario === 'm1-fight') events.push(...spawnFightWave(world))
  return events
}
