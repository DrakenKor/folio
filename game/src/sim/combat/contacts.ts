import { fmath } from '../core/fmath'
import { actionPhase } from '../core/timing'
import { TICK_DT } from '../core/types'
import type { ActionState, Entity, EntityId, KnockbackSpec, Projectile, Vec2, World } from '../core/types'
import type { ActorTick } from '../systems/actors'
import { sectorOverlaps, sweepCircle } from './geometry'

export interface Contact {
  travelFraction: number
  actorId: EntityId
  targetId: EntityId
  skillId: string
  actionStartTick: number
  action: ActionState | null
  projectileId: EntityId | null
  direction: Vec2
  damage: number
  knockback: KnockbackSpec
  impactPauseTicks: number
  hitFlashTicks: number
}

function hostile(source: Entity, target: Entity, faction = source.faction): boolean {
  return !source.death && !target.death && source.id !== target.id && faction !== target.faction
}

/** Allocate in actor order and capture immutable impact payloads before sweeping. */
export function launchProjectiles(world: World, states: Map<EntityId, ActorTick>): Set<EntityId> {
  const launched = new Set<EntityId>()
  for (const actor of world.entities) {
    const action = actor.action
    if (actor.death || states.get(actor.id)!.paused || !action || action.kind !== 'projectile' || action.projectileSpawned) continue
    const skill = world.content.skills.find(value => value.id === action.id)!
    if (skill.kind !== 'projectile' || actionPhase(skill.timing, action.ageTicks) !== 'active') continue
    action.projectileSpawned = true
    const shot: Projectile = {
      id: world.nextId++, ownerId: actor.id, faction: actor.faction, skillId: skill.id, actionStartTick: action.startTick,
      pos: { ...actor.pos }, vel: { x: fmath.cos(action.direction) * skill.speed, z: fmath.sin(action.direction) * skill.speed },
      radius: skill.radius, ageTicks: 0, lifetimeTicks: skill.lifetimeTicks, damage: skill.damage,
      knockback: { ...skill.knockback }, impactPauseTicks: skill.impactPauseTicks, hitFlashTicks: skill.hitFlashTicks
    }
    world.projectiles.push(shot)
    launched.add(shot.id)
  }
  return launched
}

/** Gather contacts without applying outcomes, then sort by the contract's total order. */
export function gatherContacts(world: World, states: Map<EntityId, ActorTick>, launched: Set<EntityId>): Contact[] {
  const contacts: Contact[] = []
  const actors = new Map(world.entities.map(actor => [actor.id, actor]))
  for (const actor of world.entities) {
    const action = actor.action
    if (actor.death || states.get(actor.id)!.paused || !action || action.kind !== 'melee') continue
    const skill = world.content.skills.find(value => value.id === action.id)!
    if (skill.kind !== 'melee' || actionPhase(skill.timing, action.ageTicks) !== 'active') continue
    for (const target of world.entities) {
      if (!hostile(actor, target) || action.hitTargetIds.includes(target.id) ||
        !sectorOverlaps(actor.pos, action.direction, skill.range, skill.arcRadians, target)) continue
      contacts.push({
        ...skill, travelFraction: 0, actorId: actor.id, targetId: target.id, skillId: skill.id,
        actionStartTick: action.startTick, action, projectileId: null,
        direction: { x: fmath.cos(action.direction), z: fmath.sin(action.direction) }
      })
    }
  }
  world.projectiles = world.projectiles.filter(shot => {
    const owner = actors.get(shot.ownerId)
    if (!owner || owner.death) return false
    if (!launched.has(shot.id)) shot.ageTicks++
    return shot.ageTicks < shot.lifetimeTicks
  })
  for (const shot of world.projectiles) {
    const owner = actors.get(shot.ownerId)!
    const from = { ...shot.pos }
    shot.pos.x += shot.vel.x * TICK_DT
    shot.pos.z += shot.vel.z * TICK_DT
    const speed = Math.sqrt(shot.vel.x * shot.vel.x + shot.vel.z * shot.vel.z)
    const direction = speed === 0 ? { x: 0, z: 0 } : { x: shot.vel.x / speed, z: shot.vel.z / speed }
    for (const target of world.entities) {
      if (!hostile(owner, target, shot.faction)) continue
      const fraction = sweepCircle(from, shot.pos, target.pos, target.radius + shot.radius)
      if (fraction === null) continue
      contacts.push({
        ...shot, travelFraction: fraction, actorId: shot.ownerId, targetId: target.id, projectileId: shot.id,
        action: null, direction
      })
    }
  }
  return contacts.sort((a, b) => a.travelFraction - b.travelFraction || a.targetId - b.targetId ||
    a.actorId - b.actorId || (a.projectileId ?? 0) - (b.projectileId ?? 0))
}
