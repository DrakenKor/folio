import { fmath } from '../core/fmath'
import { actionPhase } from '../core/timing'
import { Button } from '../core/types'
import type { ActionTiming, Entity, SimEvent, Vec2, World } from '../core/types'
import type { ActorTick } from '../systems/actors'

/** Normalize finite input without overflowing on large command components. */
export function movementInput(move: Vec2): { direction: Vec2; magnitude: number } {
  const scale = Math.max(Math.abs(move.x), Math.abs(move.z))
  if (scale === 0) return { direction: { x: 0, z: 0 }, magnitude: 0 }
  const x = move.x / scale
  const z = move.z / scale
  const length = Math.sqrt(x * x + z * z)
  return { direction: { x: x / length, z: z / length }, magnitude: Math.min(1, scale * length) }
}

export function actionTiming(world: World, actor: Entity): ActionTiming | null {
  if (!actor.action) return null
  return actor.action.kind === 'dodge' ? world.content.dodge.timing :
    world.content.skills.find(skill => skill.id === actor.action!.id)!.timing
}

function startSkill(world: World, actor: Entity, skillId: string, events: SimEvent[]): void {
  const skill = world.content.skills.find(value => value.id === skillId)!
  actor.action = {
    id: skill.id, kind: skill.kind, startTick: world.tick, ageTicks: 0, direction: actor.aim,
    hitTargetIds: [], projectileSpawned: false
  }
  events.push({ type: 'action', tick: world.tick, id: actor.id, action: skill.id })
}

/** Arbitrate one actor after age/cooldown advancement and AI intent generation. */
export function selectAction(world: World, actor: Entity, state: ActorTick, events: SimEvent[]): void {
  if (actor.death || state.paused || actor.knockback) return
  const timing = actionTiming(world, actor)
  const phase = timing && actor.action ? actionPhase(timing, actor.action.ageTicks) : null
  if (state.dodgePressed && actor.cooldowns.dodge === 0 &&
    (!actor.action || (actor.action.kind !== 'dodge' && phase !== 'active'))) {
    const { direction, magnitude } = movementInput(state.command.move)
    actor.action = {
      id: 'dodge', kind: 'dodge', startTick: world.tick, ageTicks: 0,
      direction: magnitude > 0 ? fmath.atan2(direction.z, direction.x) : actor.facing,
      hitTargetIds: [], projectileSpawned: false
    }
    actor.cooldowns.dodge = world.content.dodge.cooldownTicks
    events.push({ type: 'dodge', tick: world.tick, actorId: actor.id, targetId: null, position: { ...actor.pos } })
  } else if (actor.action && timing && phase === 'recovery' &&
    (state.command.move.x !== 0 || state.command.move.z !== 0) &&
    actor.action.ageTicks - timing.windupTicks - timing.activeTicks >= timing.moveCancelTicks) {
    actor.action = null
  }
  if (actor.action) return
  for (const [slot, bit] of [['primary', Button.Primary], ['secondary', Button.Secondary]] as const) {
    const id = actor.skills[slot]
    if (!(state.command.buttons & bit) || id === null || actor.cooldowns[slot] > 0) continue
    startSkill(world, actor, id, events)
    actor.cooldowns[slot] = world.content.skills.find(skill => skill.id === id)!.cooldownTicks
    break
  }
}
