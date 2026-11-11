import type { Entity, EntityId, SimEvent, World } from '../core/types'
import type { Contact } from './contacts'

function immune(world: World, target: Entity): boolean {
  const action = target.action
  return action?.kind === 'dodge' && action.ageTicks >= world.content.dodge.invulnerableFrom &&
    action.ageTicks < world.content.dodge.invulnerableUntil
}

function kill(world: World, target: Entity): void {
  target.action = null
  target.vel = { x: 0, z: 0 }
  target.gait.speed = 0
  target.knockback = null
  target.impactPauseTicks = 0
  target.death = {
    startTick: world.tick, ageTicks: 0,
    despawnAfterTicks: target.ai ? world.content.enemies.find(enemy => enemy.id === target.ai!.enemyId)!.deathTicks : null
  }
  if (target.ai) {
    target.ai.phase = 'die'
    target.ai.ageTicks = 0
    target.ai.targetId = null
  }
  world.projectiles = world.projectiles.filter(shot => shot.ownerId !== target.id)
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
    const amount = Math.min(target.health, contact.damage)
    if (amount === 0) continue
    target.health -= amount
    events.push({ ...impact, type: 'damage', position: { ...target.pos }, skillId: contact.skillId, amount, health: target.health })
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
      kill(world, target)
      for (const pending of shots.values()) {
        if (pending.ownerId === target.id) shots.delete(pending.id)
      }
      events.push({ ...impact, type: 'death', position: { ...target.pos } })
    }
  }
  world.projectiles = world.projectiles.filter(shot => shots.has(shot.id))
}
