import { withSharedBuildRules } from '../../core/profile'
import { TICK_DT } from '../../core/types'
import type { M3World, Projectile, ResolvedAction, SimEvent } from '../../core/types'
import type { ActorTick } from '../../systems/actors'
import { launchProjectiles } from '../contacts'
import { sweepCircle } from '../geometry'
import { clip, distance, visible } from './geometry'
import { contact, type Attack } from './impact'
import { foldOf, hitGroup, price, remember } from './records'
import type { PendingContact } from '../../core/m3-loop'

function shotRecipe(world: M3World, shot: Projectile): ResolvedAction {
  if (shot.recipe) return shot.recipe
  const skill = world.content.skills.find(s => s.id === shot.skillId)!
  return { skillId: skill.id, tags: ['projectile'], folds: [], sourceDamage: { weight: shot.damage, heat: 0, gale: 0 },
    timing: skill.timing, modifiers: [], footprint: { kind: 'projectile', reach: 0, arcRadians: 0, radius: shot.radius,
      speed: distance({ x: 0, z: 0 }, shot.vel), lifetimeTicks: shot.lifetimeTicks, projectileAngles: [0] } }
}

export function shotContacts(world: M3World, states: Map<number, ActorTick>, events: SimEvent[]) {
  const launched = withSharedBuildRules(world, view => launchProjectiles(view, states, a => !a.ai))
  const contacts: PendingContact[] = []
  for (const shot of [...world.projectiles]) {
    const source = world.entities.find(a => a.id === shot.ownerId)!
    const remove = () => { world.projectiles = world.projectiles.filter(s => s !== shot) }
    if (source.death || (!launched.has(shot.id) && ++shot.ageTicks >= shot.lifetimeTicks)) { remove(); continue }
    const r = shotRecipe(world, shot), from = shot.pos
    const stride = distance({ x: 0, z: 0 }, shot.vel) * TICK_DT
    const fraction = r.footprint.reach && stride ? Math.max(0, Math.min(1, r.footprint.reach / stride - shot.ageTicks)) : 1
    const next = { x: from.x + shot.vel.x * TICK_DT * fraction, z: from.z + shot.vel.z * TICK_DT * fraction }
    shot.pos = clip(world, from, next)
    const wall = !visible(world, from, next)
    const limit = foldOf(world, r, 'through')?.maxContacts ?? 1
    const ray = hitGroup(world, source, shot.actionStartTick, 'shot:' + shot.id)
    const shared = world.actionGroups.find(g => g.id === shot.groupId)
    const attack: Attack = { owner: source, origin: from, recipe: r, factor: price(world, r), projectile: shot,
      startTick: shot.actionStartTick, effectId: shot.id, accept(t) {
        if (ray.hitTargetIds.length >= limit) return false
        remember(ray.hitTargetIds, t.id)
        if (ray.hitTargetIds.length === limit) remove()
        // Each Splay ray spends a contact, but only the first damages this target.
        if (shared?.hitTargetIds.includes(t.id)) return false
        if (shared) remember(shared.hitTargetIds, t.id)
        return true
      } }
    const tickFraction = stride ? distance(from, shot.pos) / stride : 0
    for (const t of world.entities) {
      if (t.death || t.faction === source.faction || ray.hitTargetIds.includes(t.id) || !visible(world, from, t.pos)) continue
      const travel = sweepCircle(from, shot.pos, t.pos, shot.radius + t.radius)
      if (travel !== null) contacts.push(contact(world, attack, t, travel * tickFraction, events))
    }
    if (wall || fraction < 1) remove()
  }
  return contacts
}
