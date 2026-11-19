import type { Entity, M3World, OwnedEffect, Vec2 } from '../../core/types'
import type { ActorTick } from '../../systems/actors'
import { along, clip, distance, heading, shape } from './geometry'
import { drawing, foldOf, record } from './records'

export interface StepSweep { effect: OwnedEffect; from: Vec2; to: Vec2 }

/** Move the actor along the same clipped stroke used for contact. */
export function stepStroke(world: M3World, actor: Entity, state: ActorTick) {
  const a = actor.action
  if (!a?.recipe) return
  const r = a.recipe, m = drawing(world, a.id)?.mechanic
  if (m?.kind !== 'open-hem' || a.ageTicks < r.timing.windupTicks || a.ageTicks >= r.timing.windupTicks + r.timing.activeTicks) return
  const age = a.ageTicks - r.timing.windupTicks
  const group = actor.id + ':' + a.startTick
  let stroke = world.effects.find(e => e.kind === 'echo' && e.groupId === group && e.recipe.skillId === a.id)
  if (!stroke) {
    stroke = record(world, actor, r, 'echo', shape('lane', actor.pos, a.direction, r.footprint.reach, m.halfWidth), world.tick, Number.MAX_SAFE_INTEGER)
    stroke.endpoint = clip(world, actor.pos, along(actor.pos, a.direction, r.footprint.reach))
  }
  if (age && distance(actor.pos, stroke.endpoint!) < 1e-9) {
    const hinge = foldOf(world, r, 'hinge')
    if (!hinge || stroke.leg) return
    stroke.leg++
    stroke.acceptedTargetIds = []
    const origin = stroke.footprint.origin
    stroke.endpoint = along(actor.pos, heading(actor.pos, origin), distance(origin, actor.pos) * hinge.retraceFraction)
  }
  const end = stroke.endpoint!, from = { ...actor.pos }, remaining = distance(from, end)
  const stride = r.footprint.reach / m.stepTicks
  actor.pos = clip(world, from, remaining <= stride ? end : along(from, heading(from, end), stride))
  state.sweep = { effect: stroke, from, to: { ...actor.pos } }
}
