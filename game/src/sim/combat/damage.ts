import type { Entity, EntityId, SimEvent, World } from '../core/types'
import { applyAilments } from './ailments'
import type { Contact } from './contacts'
import { calculateDamage } from './damage-model'
import { kill } from './death'
import { actorStats } from './stats'

function immune(world: World, target: Entity): boolean {
  const action = target.action
  return action?.kind === 'dodge' && action.ageTicks >= world.content.dodge.invulnerableFrom &&
    action.ageTicks < world.content.dodge.invulnerableUntil
}

/** Commit each contact immediately so interruption/death invalidate later pending work. */
export function resolveContacts(world: World, contacts: Contact[], launched: Set<EntityId>, events: SimEvent[]): void {
  const actors = new Map(world.entities.map(actor => [actor.id, actor]))
  const shots = new Map(world.projectiles.map(shot => [shot.id, shot]))
  for (const contact of contacts) {
    const source = actors.get(contact.actorId)!
    const target = actors.get(contact.targetId)!
    const shot = contact.projectileId === null ? null : shots.get(contact.projectileId)
    if (source.death || target.death || source.id === target.id ||
      (shot?.faction ?? source.faction) === target.faction) continue
    if (contact.projectileId !== null) {
      if (!shot) continue
      shots.delete(shot.id)
    } else if (source.action !== contact.action || contact.action!.hitTargetIds.includes(target.id)) continue
    if (shot?.groupId) {
      const group = world.actionGroups.find(group => group.id === shot.groupId)!
      if (group.hitTargetIds.includes(target.id)) continue
      group.hitTargetIds.push(target.id)
      group.hitTargetIds.sort((a, b) => a - b)
    }
    if (immune(world, target)) continue
    if (contact.action) {
      contact.action.hitTargetIds.push(target.id)
      contact.action.hitTargetIds.sort((a, b) => a - b)
    }
    const impact = { tick: world.tick, actorId: source.id, targetId: target.id }
    events.push({
      ...impact, type: 'hit', position: { ...target.pos }, skillId: contact.skillId,
      actionStartTick: contact.actionStartTick, projectileId: contact.projectileId
    })
    const recipe = contact.action?.recipe ?? shot?.recipe
    const damage = recipe && calculateDamage(recipe, actorStats(world, target, recipe.tags).reductions, target.health)
    const amount = damage?.applied ?? Math.min(target.health, contact.damage)
    if (amount === 0) continue
    target.health -= amount
    events.push({ ...impact, type: 'damage', position: { ...target.pos }, skillId: contact.skillId, amount, health: target.health })
    if (damage) applyAilments(world, source.id, target.id, damage.postDefence)
    target.action = null
    // Already flying shots survive interruption; this tick's pending launches do not.
    for (const pending of shots.values()) {
      if (pending.ownerId === target.id && launched.has(pending.id)) shots.delete(pending.id)
    }
    target.knockback = contact.knockback.ticks === 0 ? null : {
      vel: { x: contact.direction.x * contact.knockback.speed, z: contact.direction.z * contact.knockback.speed },
      remainingTicks: contact.knockback.ticks
    }
    target.impactPauseTicks = Math.max(target.impactPauseTicks, contact.impactPauseTicks)
    target.hitFlashTicks = Math.max(target.hitFlashTicks, contact.hitFlashTicks)
    if (contact.projectileId === null) source.impactPauseTicks = Math.max(source.impactPauseTicks, contact.impactPauseTicks)
    if (target.health === 0) {
      kill(world, target, source.id, events)
      for (const pending of shots.values()) {
        if (pending.ownerId === target.id) shots.delete(pending.id)
      }
    }
  }
  world.projectiles = world.projectiles.filter(shot => shots.has(shot.id))
  if (world.actionGroups.length) {
    const live = new Set(world.projectiles.map(shot => shot.groupId))
    for (const actor of world.entities) if (actor.action?.groupId) live.add(actor.action.groupId)
    world.actionGroups = world.actionGroups.filter(group => live.has(group.id))
  }
}
