import type { PendingContact } from '../../core/m3-loop'
import { TICK_DT, TICK_HZ } from '../../core/types'
import type { Entity, Footprint, M3World, OwnedEffect, SimEvent, Vec2 } from '../../core/types'
import type { ActorTick } from '../../systems/actors'
import { along, clip, distance, heading, overlap, shape, visible } from './geometry'
import { areaContacts, echo, effectAttack, type Attack } from './impact'
import { drawing, eyeOf, foldOf, price, record, remember } from './records'

const parked = 2
function eyePosition(e: OwnedEffect, tick: number) {
  const f = e.footprint
  if (e.leg === parked) return { ...f.origin }
  const travel = Math.min(f.reach, Math.max(0, tick - e.dueTick + 1) * e.recipe.footprint.speed * TICK_DT)
  return along(f.origin, f.direction, travel)
}

function rimShapes(world: M3World, e: OwnedEffect | Attack, f: Footprint) {
  const rim = foldOf(world, e.recipe, 'rim')
  if (!rim) return [f]
  return [-1, 1].map(sign => ({ ...f, origin: along(f.origin, f.direction + Math.PI / 2, sign * rim.offset),
    radius: f.kind === 'disc' ? rim.tileRadius : f.radius, halfWidth: f.kind === 'lane' ? rim.laneHalfWidth : f.halfWidth }))
    .filter(piece => visible(world, f.origin, piece.origin))
}

function claim(ids: number[], target: Entity) {
  if (ids.includes(target.id)) return false
  remember(ids, target.id)
  return true
}

function eyeContacts(world: M3World, e: OwnedEffect, owner: Entity, events: SimEvent[]) {
  if (e.leg === parked) return []
  const f = e.footprint, r = e.recipe, attack = effectAttack(world, owner, e)
  const from = eyePosition(e, world.tick - 1), to = clip(world, from, eyePosition(e, world.tick))
  const end = along(f.origin, f.direction, f.reach)
  const hinge = foldOf(world, r, 'hinge'), returning = drawing(world, r.skillId)?.mechanic.kind === 'gather-line'
  const ids = e.acceptedTargetIds
  attack.accept = t => claim(ids, t)
  attack.catchHistory = e.excludedTargetIds
  attack.origin = from
  if (e.leg === 1 && hinge) { attack.secondary = true; attack.factor = hinge.returnFactor }
  const sweep = shape('lane', from, f.direction, distance(from, to), r.footprint.radius)
  const hits = areaContacts(world, attack, [sweep], events, Math.min(1, sweep.reach / (r.footprint.speed * TICK_DT)))
  if (distance(to, end) > 1e-8 && visible(world, from, eyePosition(e, world.tick))) return hits
  if (returning) world.effects = world.effects.filter(other => other !== e)
  else if (hinge && e.leg === 0 && distance(f.origin, to) > 0) {
    e.footprint = { ...f, origin: to, direction: f.direction + Math.PI, reach: distance(f.origin, to) * hinge.retraceFraction }
    e.acceptedTargetIds = []
    e.leg = 1
    e.dueTick = world.tick + 1
    if (e.dueTick >= e.expiresTick) world.effects = world.effects.filter(other => other !== e)
  } else {
    e.leg = parked
    e.footprint = { ...f, origin: to }
  }
  return hits
}

function sightContacts(world: M3World, attack: Attack, f: Footprint, events: SimEvent[]) {
  const limit = foldOf(world, attack.recipe, 'through')?.maxContacts ?? 1
  let accepted = 0
  const ready = attack.accept
  attack.accept = t => {
    if (accepted >= limit || (ready && !ready(t))) return false
    accepted++
    return true
  }
  attack.canTrigger = () => accepted === 1
  attack.catchHistory = []
  return areaContacts(world, attack, [f], events)
}

function releaseDrawing(world: M3World, actor: Entity, state: ActorTick, events: SimEvent[]) {
  const a = actor.action, r = a?.recipe
  if (!a || !r || state.paused || actor.ai || actor.death) return []
  const m = drawing(world, a.id)?.mechanic
  const activeAge = a.ageTicks - r.timing.windupTicks
  if (!m || activeAge < 0 || activeAge >= r.timing.activeTicks) return []
  const f = r.footprint
  const attack: Attack = { owner: actor, recipe: r, effectId: 0, startTick: a.startTick, origin: actor.pos,
    factor: price(world, r), accept: () => actor.action === a }
  const catcher = foldOf(world, r, 'catch')
  switch (m.kind) {
    case 'open-hem': {
      const sweep = state.sweep
      if (!sweep) return []
      const { from, to, effect } = sweep
      attack.effectId = effect.id
      attack.origin = from
      attack.accept = t => actor.action === a && claim(effect.acceptedTargetIds, t)
      if (effect.leg) { attack.secondary = true; attack.factor = foldOf(world, r, 'hinge')!.returnFactor }
      const lane = shape('lane', from, heading(from, to), distance(from, to), m.halfWidth)
      return areaContacts(world, attack, [lane], events, Math.min(1, lane.reach / (f.reach / m.stepTicks)))
    }
    case 'span-cut': {
      const footprint = shape('sector', actor.pos, a.direction, f.reach, 0, 0, f.arcRadians)
      if (activeAge === 0) echo(world, actor, r, footprint)
      attack.accept = t => actor.action === a && claim(a.hitTargetIds, t)
      const group = world.actionGroups.find(g => g.id === a.groupId)!
      attack.onPositive = target => {
        if (group.hitTargetIds.length) return
        remember(group.hitTargetIds, target.id)
        const mechanics = actor.mechanics!
        mechanics.counter = { value: Math.min(m.maxSeams, 1 + (mechanics.counter?.value ?? 0)), expiresTick: world.tick + m.refreshTicks }
      }
      return areaContacts(world, attack, [footprint], events)
    }
    case 'plinth-blow': {
      if (actor.mechanics!.held || activeAge) return []
      const footprint = shape('disc', actor.pos, 0, 0, 0, f.reach)
      echo(world, actor, r, footprint)
      attack.charged = world.effects.some(e => e.kind === 'counter' && e.ownerId === actor.id && e.recipe.skillId === a.id)
      return areaContacts(world, attack, [footprint], events)
    }
    case 'brace-mark':
      if (!activeAge) record(world, actor, r, 'counter', shape('sector', actor.pos, a.direction, m.answerReach, 0, 0, Math.PI), world.tick, Number.MAX_SAFE_INTEGER)
      break
    case 'cast-loop': {
      if (activeAge || a.projectileSpawned) break
      const end = clip(world, actor.pos, along(actor.pos, a.direction, f.reach))
      const eye = record(world, actor, r, 'eye', shape('disc', actor.pos, a.direction, distance(actor.pos, end), 0, f.radius),
        world.tick, world.tick + m.eyeLifetime)
      a.projectileSpawned = true
      if (!eye.footprint.reach) eye.leg = parked
      break
    }
    case 'gather-line': {
      if (activeAge || a.projectileSpawned) break
      a.projectileSpawned = true
      const eye = eyeOf(world, actor)
      if (!eye?.endpoint) break
      const from = eyePosition(eye, world.tick - 1), end = clip(world, from, eye.endpoint)
      world.effects = world.effects.filter(e => e !== eye)
      const reach = distance(from, end), due = world.tick + (catcher?.delayTicks ?? 0)
      const back = record(world, actor, r, 'eye', shape('disc', from, heading(from, end), reach, 0, f.radius),
        due, due + Math.ceil(TICK_HZ * reach / f.speed) + 1)
      back.endpoint = end
      break
    }
    case 'lay-bed': {
      if (activeAge) break
      const tile = world.effects.find(e => e.ownerId === actor.id && e.kind === 'tile' && !e.leg)
      if (!tile) break
      world.effects = world.effects.filter(e => e === tile || e.ownerId !== actor.id || e.kind !== 'tile')
      tile.startTick = world.tick
      tile.leg = 1
      tile.dueTick = world.tick + m.armTicks
      tile.expiresTick = world.tick + m.expiryTicks
      break
    }
    case 'lift-print': {
      if (activeAge) break
      const sight = shape('lane', actor.pos, a.direction, f.reach, m.halfWidth)
      if (catcher) record(world, actor, r, 'echo', sight, world.tick + catcher.delayTicks)
      else return sightContacts(world, attack, sight, events)
      break
    }
    case 'rill-fan': {
      const held = actor.mechanics!.held
      if (!held || activeAge % m.pulseTicks) break
      if (activeAge === (m.maxPulses - 1) * m.pulseTicks) {
        actor.mechanics!.rearmButtons |= held.button
        actor.mechanics!.held = null
      }
      const lane = shape('lane', actor.pos, a.direction, f.reach, m.halfWidth)
      return areaContacts(world, attack, rimShapes(world, attack, lane), events)
    }
  }
  return []
}

export function drawingContacts(world: M3World, states: Map<number, ActorTick>, events: SimEvent[]) {
  const contacts: PendingContact[] = []
  for (const actor of world.entities) contacts.push(...releaseDrawing(world, actor, states.get(actor.id)!, events))
  for (const e of [...world.effects]) {
    if (e.dueTick > world.tick) continue
    const owner = world.entities.find(a => a.id === e.ownerId)!
    if (owner.death) continue
    const attack = effectAttack(world, owner, e), m = drawing(world, e.recipe.skillId)?.mechanic
    if (e.kind === 'eye') { contacts.push(...eyeContacts(world, e, owner, events)); continue }
    if (e.kind === 'warning') {
      attack.accept = t => visible(world, e.endpoint ?? e.footprint.origin, t.pos)
      contacts.push(...areaContacts(world, attack, [e.footprint], events))
    } else if (e.kind === 'tile' && e.leg) {
      const shapes = rimShapes(world, e, e.footprint)
      attack.catchHistory = e.excludedTargetIds
      const hits = areaContacts(world, attack, shapes, events)
      if (!hits.length && e.leg === 1) continue
      const catcher = foldOf(world, e.recipe, 'catch')
      if (catcher && e.leg === 1) {
        e.leg = 2
        e.dueTick = world.tick + catcher.delayTicks
        e.expiresTick = e.dueTick + 1
        continue
      }
      contacts.push(...hits)
    } else if (e.kind === 'mark') {
      e.excludedTargetIds = e.excludedTargetIds.filter(id => {
        const t = world.entities.find(a => a.id === id)
        return t && overlap(world, e.footprint, t) !== null
      })
      attack.accept = t => !e.excludedTargetIds.includes(t.id) && !e.acceptedTargetIds.length && claim(e.acceptedTargetIds, t)
      attack.secondary = true
      attack.factor = foldOf(world, e.recipe, 'catch')!.entrantFactor
      contacts.push(...areaContacts(world, attack, [e.footprint], events))
      continue
    } else if (e.kind === 'echo' && m?.kind !== 'open-hem') {
      if (m?.kind === 'lift-print') contacts.push(...sightContacts(world, attack, e.footprint, events))
      else {
        attack.secondary = true
        attack.factor = foldOf(world, e.recipe, 'after')!.echoFactor
        contacts.push(...areaContacts(world, attack, [e.footprint], events))
      }
    } else continue
    world.effects = world.effects.filter(other => other !== e)
  }
  return contacts
}
