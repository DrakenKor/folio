import { driveM3Enemies, moveRushes } from '../ai/m3-combat/intents'
import { selectDrawings } from '../combat/m3/actions'
import { drawingContacts } from '../combat/m3/effects'
import { shotContacts } from '../combat/m3/projectiles'
import { clearFinished } from '../combat/m3/records'
import { applyCombatOperation, processAilments } from '../combat/build'
import { applyProgressionOperation, processProgression } from '../progression'
import { advanceActors, beginActors } from '../systems/actors'
import { finalizeGait, moveEntities } from '../systems/movement'
import { clearOwnedEffects, retainEffects } from './m3-state'
import { sharedBuildView, withSharedBuildRules } from './profile'
import { Button, IDLE_COMMAND } from './types'
import type { Command, Entity, M3ActionDefinition, M3World, Operation, OperationResult, SimEvent } from './types'

export interface ContactOrder {
  travelFraction: number
  targetId: number
  actorId: number
  effectId: number
  childOrdinal: number
}
export function compareContacts(a: ContactOrder, b: ContactOrder): number {
  return a.travelFraction - b.travelFraction || a.targetId - b.targetId || a.actorId - b.actorId ||
    a.effectId - b.effectId || a.childOrdinal - b.childOrdinal
}
export interface ContactActors { source: Entity; target: Entity; immune: boolean }
/** Immune geometric contacts still consume their own leg's contact budget. */
export interface PendingContact extends ContactOrder { commit(actors: ContactActors): void | PendingChild[] }
export interface PendingChild extends ContactOrder { commit(actors: ContactActors): void }
export function commitContacts(world: M3World, contacts: PendingContact[]): void {
  function live(contact: ContactOrder): ContactActors | undefined {
    const source = world.entities.find(a => a.id === contact.actorId)
    const target = world.entities.find(a => a.id === contact.targetId)
    if (!source || source.death || !target || target.death || source.faction === target.faction) return
    const dodge = world.content.dodge
    const immune = target.action?.kind === 'dodge' && target.action.ageTicks >= dodge.invulnerableFrom &&
      target.action.ageTicks < dodge.invulnerableUntil
    return { source, target, immune }
  }
  for (const contact of contacts.sort(compareContacts)) {
    const pair = live(contact)
    if (!pair) continue
    const children = contact.commit(pair)
    if (children) for (const child of children.sort(compareContacts)) {
      const next = live(child)
      if (next) child.commit(next)
    }
  }
}

export function lockedReason(world: M3World, actor: Entity, action: M3ActionDefinition) {
  const c = actor.character
  if (!c) return null
  if (action.familyId === 'survey-tally') return c.equipment['survey-tally'] === null ? 'tally-required' : null
  const base = c.items.find(i => i.id === c.equipment.weapon)?.baseId
  return world.content.m3.itemBases.some(b => b.role === 'weapon' && b.id === base && b.familyId === action.familyId) ? null : 'wrong-family'
}

type States = ReturnType<typeof beginActors>
export interface M3Systems {
  operation(world: M3World, edit: Operation): OperationResult
  /** Resolve an F edge from the same tick-entry state as an explicit interaction. */
  interaction(world: M3World): Operation | null
  timers(world: M3World, states: States, events: SimEvent[]): void
  ai(world: M3World, states: States): void
  actions(world: M3World, states: States, events: SimEvent[]): void
  movement(world: M3World, states: States): void
  contacts(world: M3World, states: States, events: SimEvent[]): PendingContact[]
  rewards(world: M3World, events: SimEvent[]): void
  quest(world: M3World, events: readonly SimEvent[]): void
}
const unsupported = { accepted: false, reason: 'unsupported' } as const

function applyOperation(world: M3World, edit: Operation): OperationResult {
  if (edit.type === 'interact' || edit.type === 'travel' || edit.type === 'restAtMarker') return unsupported
  if (edit.type === 'beginEncounter' && world.scenario === 'm3-act1') return { accepted: false, reason: 'wrong-scenario' }
  const player = world.entities.find(a => a.id === world.playerId)
  if (player?.character && !player.death && world.encounter?.phase === 'rest') {
    if (edit.type === 'setLoadout') for (const id of edit.slots) {
      const action = world.content.m3.actions.find(a => a.id === id)
      const reason = action && lockedReason(world, player, action)
      if (reason) return { accepted: false, reason }
    }
    if (edit.type === 'setFolds' && edit.foldIds.some(id => {
      const fold = world.content.m3.folds.find(f => f.id === id)
      return fold && !fold.whitelist.includes(edit.skillId)
    })) return { accepted: false, reason: 'incompatible-fold' }
  }
  return withSharedBuildRules(world, view => edit.type === 'setLoadout' || edit.type === 'setFolds' ?
    applyCombatOperation(view, edit) : applyProgressionOperation(view, edit))
}

/** Static composition point for the combat, progression and Act I world implementations. */
export const m3Systems: M3Systems = {
  operation: applyOperation,
  interaction: () => null,
  timers(world, states, events) {
    clearFinished(world)
    withSharedBuildRules(world, view => {
      advanceActors(view, states, events)
      processAilments(view, events)
    })
  },
  ai: driveM3Enemies,
  actions: (world, states, events) => selectDrawings(world, states, events, lockedReason),
  movement(world, states) {
    withSharedBuildRules(world, view => moveEntities(view, states))
    moveRushes(world)
    finalizeGait(world, states)
  },
  contacts(world, states, events) {
    return [...drawingContacts(world, states, events), ...shotContacts(world, states, events)]
  },
  rewards: (world, events) => withSharedBuildRules(world, view => processProgression(view, events)),
  quest() {}
}

export function stepM3(world: M3World, input: Command, systems: M3Systems): SimEvent[] {
  const events: SimEvent[] = []
  const ops = [...(input.operations ?? [])]
  const player = world.entities.find(a => a.id === world.playerId)
  const previous = player?.previousButtons ?? 0
  input.pressedButtons = (input.pressedButtons ?? 0) | (input.buttons & ~previous)
  input.releasedButtons = (input.releasedButtons ?? 0) | (previous & ~input.buttons)
  if ((input.pressedButtons & Button.Interact) && !ops.some(op => op.type === 'interact' || op.type === 'pickup')) {
    const op = systems.interaction(world)
    if (op) ops.push(op)
  }
  world.tick++
  let travelled = false
  for (const [index, operation] of ops.entries()) {
    const origin = world.zoneId
    const result = travelled ? { accepted: false, reason: 'travel-committed' } as const : systems.operation(world, operation)
    events.push(result.accepted ? { type: 'operationAccepted', tick: world.tick, index, operation, reason: 'ok' } :
      { type: 'operationRejected', tick: world.tick, index, operation, reason: result.reason })
    if (!result.accepted) continue
    travelled = operation.type === 'travel' || origin !== world.zoneId
    if (travelled || operation.type === 'restAtMarker' || operation.type === 'returnToShelter') clearOwnedEffects(world)
    if (travelled || ['beginEncounter', 'restAtMarker', 'returnToShelter'].includes(operation.type)) {
      input = { ...IDLE_COMMAND, pressedButtons: 0, releasedButtons: 0, cancelHeld: true }
    }
  }
  const states = beginActors(world, input)
  for (const actor of world.entities) {
    const m = actor.mechanics!
    if (m.counter && m.counter.expiresTick <= world.tick) m.counter = null
    const state = states.get(actor.id)!
    const cmd = state.command
    if (cmd.cancelHeld) {
      if (m.held) actor.action = null
      m.held = null
      m.rearmButtons = cmd.buttons
    } else {
      m.rearmButtons &= cmd.buttons
      if (m.held && ((cmd.releasedButtons ?? 0) & m.held.button)) m.held.releasePending = true
    }
  }
  retainEffects(world, e => e.expiresTick > world.tick)
  systems.timers(world, states, events)
  systems.ai(world, states)
  systems.actions(world, states, events)
  systems.movement(world, states)
  commitContacts(world, systems.contacts(world, states, events))
  systems.rewards(world, events)
  for (const actor of world.entities) {
    const m = actor.mechanics!
    if (actor.death || world.encounter?.phase === 'rest' || travelled) {
      m.held = null
      m.counter = null
      m.rearmButtons = 0
      m.rootedUntil = 0
    } else if (m.held && m.held.skillId !== actor.action?.id) m.held = null
  }
  const living = new Set(world.entities.filter(a => !a.death).map(a => a.id))
  retainEffects(world, e => living.has(e.ownerId) && world.encounter?.phase !== 'rest')
  systems.quest(world, events)
  return events
}
