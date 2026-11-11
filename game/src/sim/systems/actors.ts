import { actionTiming } from '../combat/actions'
import { fmath } from '../core/fmath'
import { removeEntity } from '../core/store'
import { actionPhase } from '../core/timing'
import { Button } from '../core/types'
import type { Command, Entity, EntityId, SimEvent, Vec2, World } from '../core/types'

/** Disposable per-tick intent and integration history; continuation stays in World. */
export interface ActorTick {
  command: Command
  paused: boolean
  previousButtons: number
  dodgePressed: boolean
  entryPosition: Vec2
  ordinary: Vec2
}

/** Consume player or AI input against the tick-entry position, including blocked edges. */
export function consumeIntent(actor: Entity, state: ActorTick, command: Command): void {
  state.command = command
  state.dodgePressed = !!(command.buttons & Button.Dodge) && !(state.previousButtons & Button.Dodge)
  actor.previousButtons = command.buttons
  if (command.aim) {
    const x = command.aim.x - state.entryPosition.x
    const z = command.aim.z - state.entryPosition.z
    if (x !== 0 || z !== 0) actor.aim = fmath.atan2(z, x)
  }
}

/** Capture entry state and advance world timers before any actor processing. */
export function beginActors(world: World, command: Command): Map<EntityId, ActorTick> {
  const states = new Map<EntityId, ActorTick>()
  for (const actor of world.entities) {
    const input = actor.id === world.playerId ? command : { move: { x: 0, z: 0 }, aim: null, buttons: 0 }
    const state: ActorTick = {
      command: input, paused: actor.impactPauseTicks > 0, previousButtons: actor.previousButtons, dodgePressed: false,
      entryPosition: { ...actor.pos }, ordinary: { x: 0, z: 0 }
    }
    states.set(actor.id, state)
    actor.impactPauseTicks = Math.max(0, actor.impactPauseTicks - 1)
    actor.hitFlashTicks = Math.max(0, actor.hitFlashTicks - 1)
    for (const slot of ['primary', 'secondary', 'dodge'] as const) {
      actor.cooldowns[slot] = Math.max(0, actor.cooldowns[slot] - 1)
    }
    consumeIntent(actor, state, input)
  }
  return states
}

/** Expire dead actors and advance only eligible processed action ages. */
export function advanceActors(world: World, states: Map<EntityId, ActorTick>, events: SimEvent[]): void {
  for (const actor of [...world.entities]) {
    if (actor.death) {
      actor.death.ageTicks++
      if (actor.death.despawnAfterTicks !== null && actor.death.ageTicks >= actor.death.despawnAfterTicks) {
        removeEntity(world, actor.id)
        states.delete(actor.id)
        events.push({ type: 'despawn', tick: world.tick, id: actor.id })
      }
    } else if (actor.action && !states.get(actor.id)!.paused) {
      actor.action.ageTicks++
      if (actionPhase(actionTiming(world, actor)!, actor.action.ageTicks) === 'complete') actor.action = null
    }
  }
}
