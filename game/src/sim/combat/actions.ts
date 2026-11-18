import { fmath } from '../core/fmath'
import { actionPhase } from '../core/timing'
import { Button } from '../core/types'
import type { ActionDefinition, ActionTiming, Entity, SimEvent, SkillDefinition, Vec2, World } from '../core/types'
import type { ActorTick } from '../systems/actors'
import { resolveRecipe } from './recipe'
import { actorStats, byId } from './stats'

const slotButtons = [Button.Primary, Button.Secondary, Button.Skill1, Button.Skill2, Button.Skill3, Button.Skill4]

export function skillDefinition(world: World, id: string) {
  return world.content.m2?.actions.find(action => action.id === id) ?? world.content.skills.find(skill => skill.id === id)!
}

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
  if (actor.action.kind === 'dodge') return actor.character ? actorStats(world, actor).dodge.timing : world.content.dodge.timing
  return actor.action.recipe?.timing ?? skillDefinition(world, actor.action.id).timing
}

function startSkill(world: World, actor: Entity, skill: SkillDefinition | ActionDefinition, events: SimEvent[]): boolean {
  const resolved = 'tags' in skill ? resolveRecipe(world, actor, skill) : undefined
  if (resolved && !resolved.ok) return false
  actor.action = {
    id: skill.id, kind: skill.kind, startTick: world.tick, ageTicks: 0, direction: actor.aim,
    hitTargetIds: [], projectileSpawned: false, ...(resolved && { recipe: resolved.value })
  }
  if (resolved && resolved.value.footprint.projectileAngles.length > 1) {
    const id = actor.id + ':' + world.tick
    actor.action.groupId = id
    world.actionGroups.push({ id, actorId: actor.id, actionStartTick: world.tick, hitTargetIds: [] })
    world.actionGroups.sort(byId)
  }
  events.push({ type: 'action', tick: world.tick, id: actor.id, action: skill.id })
  return true
}

/** Arbitrate one actor after age/cooldown advancement and AI intent generation. */
export function selectAction(world: World, actor: Entity, state: ActorTick, events: SimEvent[]): void {
  if (actor.death || state.paused || actor.knockback || (actor.character && world.encounter?.phase === 'rest')) return
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
    actor.cooldowns.dodge = actor.character ? actorStats(world, actor).dodge.cooldownTicks : world.content.dodge.cooldownTicks
    events.push({ type: 'dodge', tick: world.tick, actorId: actor.id, targetId: null, position: { ...actor.pos } })
  } else if (actor.action && timing && phase === 'recovery' &&
    (state.command.move.x !== 0 || state.command.move.z !== 0) &&
    actor.action.ageTicks - timing.windupTicks - timing.activeTicks >= timing.moveCancelTicks) {
    actor.action = null
  }
  if (actor.action || !state.command.buttons) return
  const loadout = actor.character?.loadout ?? [actor.skills.primary, actor.skills.secondary]
  for (const [index, id] of loadout.entries()) {
    if (id === null || !(state.command.buttons & slotButtons[index]!)) continue
    const slot = index === 0 ? 'primary' : 'secondary'
    if (actor.character ? actor.skillCooldowns[id]! > 0 : actor.cooldowns[slot] > 0) continue
    const skill = skillDefinition(world, id)
    if (!startSkill(world, actor, skill, events)) continue
    if (actor.character) {
      if (skill.cooldownTicks > 0) actor.skillCooldowns[id] = skill.cooldownTicks
    } else actor.cooldowns[slot] = skill.cooldownTicks
    break
  }
}
