import { actionTiming } from '../combat/actions'
import { actionPhase } from '../core/timing'
import { Button, IDLE_COMMAND } from '../core/types'
import type { AIState, Entity, EntityId, World } from '../core/types'
import { consumeIntent } from '../systems/actors'
import type { ActorTick } from '../systems/actors'

function distanceSquared(a: Entity, b: Entity): number {
  const x = a.pos.x - b.pos.x
  const z = a.pos.z - b.pos.z
  return x * x + z * z
}

function phase(ai: AIState, next: AIState['phase'], age?: number): void {
  ai.ageTicks = age ?? (ai.phase === next ? ai.ageTicks + 1 : 0)
  ai.phase = next
}

/** Generate intent in actor id order; shared arbitration owns starting every attack. */
export function driveEnemies(world: World, states: Map<EntityId, ActorTick>): void {
  for (const actor of world.entities) {
    const ai = actor.ai
    if (!ai || actor.death) continue
    const state = states.get(actor.id)!
    const enemy = world.content.enemies.find(value => value.id === ai.enemyId)!
    let target = world.entities.find(value => value.id === ai.targetId)
    if (ai.targetId !== null || ai.phase !== 'idle') {
      if (!target || target.death || target.faction === actor.faction ||
        distanceSquared(actor, target) > enemy.acquireRange * enemy.acquireRange) {
        ai.targetId = null
        phase(ai, 'idle')
        consumeIntent(actor, state, IDLE_COMMAND)
        continue
      }
    }
    if (!target) {
      let nearest = enemy.acquireRange * enemy.acquireRange
      for (const candidate of world.entities) {
        if (candidate.id === actor.id || candidate.death || candidate.faction === actor.faction) continue
        const distance = distanceSquared(actor, candidate)
        if (distance <= nearest && (!target || distance < nearest)) {
          nearest = distance
          target = candidate
        }
      }
      if (target) {
        ai.targetId = target.id
        phase(ai, 'acquire')
      } else if (!state.paused) phase(ai, 'idle')
      consumeIntent(actor, state, IDLE_COMMAND)
      continue
    }
    const aim = { ...target.pos }
    consumeIntent(actor, state, { move: { x: 0, z: 0 }, aim, buttons: 0 })
    if (state.paused) continue
    if (actor.action) {
      const timing = actionTiming(world, actor)!
      const action = actionPhase(timing, actor.action.ageTicks)
      phase(ai, action === 'windup' ? 'telegraph' : action === 'active' ? 'strike' : 'recover',
        actor.action.ageTicks - (action === 'windup' ? 0 : action === 'active' ? timing.windupTicks :
          timing.windupTicks + timing.activeTicks))
      continue
    }
    if (actor.knockback) {
      phase(ai, 'recover')
      continue
    }
    const move = { x: target.pos.x - actor.pos.x, z: target.pos.z - actor.pos.z }
    if (ai.phase === 'acquire') {
      phase(ai, 'chase')
      consumeIntent(actor, state, { move, aim, buttons: 0 })
    } else if (distanceSquared(actor, target) <= enemy.attackRange * enemy.attackRange && actor.cooldowns.primary === 0) {
      phase(ai, 'telegraph', 0)
      consumeIntent(actor, state, { move: { x: 0, z: 0 }, aim, buttons: Button.Primary })
    } else {
      phase(ai, 'chase')
      consumeIntent(actor, state, { move, aim, buttons: 0 })
    }
  }
}
