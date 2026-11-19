import { validateFootprint } from '../../content/schema'
import { validateCapturedRecipe, validateItem } from './build-validation'
import { sharedBuildView } from './profile'
import { BUTTON_MASK, EFFECT_KINDS, TRAITS } from './types'
import type { CampaignProgress, EntityId, M3World, OwnedEffect, QueryResult, ZoneInspection } from './types'

const integer = (n: number) => Number.isSafeInteger(n) && n >= 0
const stableId = (id: string) => typeof id === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)
const unique = <T>(list: T[]) => new Set(list).size === list.length
function check(condition: unknown, field: string): asserts condition {
  if (!condition) throw new TypeError('Invalid M3 ' + field)
}

function validateEffect(world: M3World, e: OwnedEffect): void {
  const owner = world.entities.find(a => a.id === e.ownerId)
  check(owner && !owner.death && EFFECT_KINDS.includes(e.kind), 'effect owner/kind')
  check(integer(e.startTick) && e.startTick <= world.tick && integer(e.dueTick) && e.dueTick >= e.startTick &&
    integer(e.expiresTick) && e.expiresTick > e.dueTick && e.expiresTick > world.tick, 'effect timing')
  check(typeof e.groupId === 'string' && e.groupId.length && integer(e.leg) && integer(e.childOrdinal) &&
    (e.endpoint === null || (Number.isFinite(e.endpoint.x) && Number.isFinite(e.endpoint.z))), 'effect path')
  for (const ids of [e.acceptedTargetIds, e.excludedTargetIds]) {
    check(Array.isArray(ids) && Array.from(ids).every((id, i) => integer(id) && id > 0 && id < world.nextId &&
      id !== owner.id && (!i || id > ids[i - 1]!)), 'effect target history')
  }
  validateFootprint(e.footprint)
  validateCapturedRecipe(e.recipe, sharedBuildView(world))
}

/** Allocate only after checking the captured effect. All actors, shots and effects share one sequence. */
export function spawnEffect(world: M3World, input: Omit<OwnedEffect, 'id'>): OwnedEffect {
  const effect = { ...structuredClone(input), id: world.nextId }
  validateEffect(world, effect)
  world.nextId++
  world.effects.push(effect)
  return effect
}

export function retainEffects(world: M3World, keep: (effect: OwnedEffect) => boolean): void {
  world.effects = world.effects.filter(keep)
  const ids = new Set(world.effects.map(e => e.id))
  for (const a of world.entities) {
    if (a.ai?.committedEffectIds) a.ai.committedEffectIds = a.ai.committedEffectIds.filter(id => ids.has(id))
  }
}

export function clearOwnedEffects(world: M3World, ownerId?: EntityId): void {
  retainEffects(world, e => ownerId !== undefined && e.ownerId !== ownerId)
}

export function validateProgress(world: M3World, p: CampaignProgress): void {
  check(p && integer(p.generatorVersion) && p.generatorVersion === 1 && ['unstarted', 'accepted', 'released', 'complete'].includes(p.stage), 'campaign')
  const zones = world.content.m3.zones ?? []
  const sockets = zones.flatMap(z => z.sockets)
  const markers = zones.flatMap(z => z.interactables.filter(i => i.kind === 'waypoint'))
  const order = world.content.m3.repairOrder ?? []
  for (const ids of [p.repairs, p.waypoints, p.creditedSockets]) {
    check(Array.isArray(ids) && unique(ids) && Array.from(ids).every(stableId), 'campaign ids')
  }
  check(p.repairs.length <= 4 && p.repairs.every((id, i) => id === order[i] &&
    markers.find(m => m.id === id)?.guardSocketIds?.every(socket => p.creditedSockets.includes(socket)) !== false) &&
    p.waypoints.every(id => id === 'hem-rest' || p.repairs.includes(id)) && p.repairs.every(id => p.waypoints.includes(id)) &&
    (p.lastSafeMarker === 'hem-rest' || p.waypoints.includes(p.lastSafeMarker)) &&
    (p.stage !== 'unstarted' || !p.repairs.length) && (['unstarted', 'accepted'].includes(p.stage) || p.repairs.length === 4), 'campaign prerequisites')
  if (p.stage === 'released' || p.stage === 'complete') check(sockets.some(s => p.creditedSockets.includes(s.id) &&
    world.content.enemies.some(e => e.id === s.enemyId && e.boss)), 'regulator prerequisite')
  check(p.creditedSockets.every(id => sockets.some(s => s.id === id)), 'credited socket')
  check(Array.isArray(p.uncollectedDrops) && p.uncollectedDrops.length <= 60 && unique(p.uncollectedDrops.map(d => d.socketId)), 'credited drops')
  const owned = world.entities.flatMap(a => a.character?.items.map(i => i.id) ?? [])
  owned.push(...world.groundDrops.map(d => d.item.id))
  for (const d of p.uncollectedDrops) {
    const zone = zones.find(z => z.id === d.zoneId)
    check(zone && zone.sockets.some(s => s.id === d.socketId) && p.creditedSockets.includes(d.socketId) &&
      Number.isFinite(d.pos.x) && Number.isFinite(d.pos.z) && d.pos.x >= 0 && d.pos.x < zone.width &&
      d.pos.z >= 0 && d.pos.z < zone.height && zone.walkable[Math.floor(d.pos.z) * zone.width + Math.floor(d.pos.x)], 'drop socket/position')
    validateItem(d.item, sharedBuildView(world))
    owned.push(d.item.id)
  }
  check(unique(owned), 'campaign item ownership')
}

export function validateM3State(world: M3World): void {
  check(world.zoneId === null || world.content.m3.zones?.some(z => z.id === world.zoneId), 'active zone')
  validateProgress(world, world.progress)
  check(Array.isArray(world.effects), 'effect table')
  const used = new Set([...world.entities, ...world.projectiles].map(record => record.id))
  let previous = 0
  for (const e of world.effects) {
    check(integer(e.id) && e.id > previous && e.id < world.nextId && !used.has(e.id), 'effect id')
    validateEffect(world, e)
    previous = e.id
  }
  for (const a of world.entities) {
    const m = a.mechanics
    check(m && integer(m.rearmButtons) && m.rearmButtons <= BUTTON_MASK && integer(m.rootedUntil), 'actor timers')
    check(m.counter === null || (integer(m.counter.value) && m.counter.value > 0 && m.counter.value <= 2 &&
      integer(m.counter.expiresTick) && m.counter.expiresTick > world.tick), 'seam counter')
    const h = m.held
    if (h !== null) {
      const card = world.content.m3.actions.find(card => card.id === h.skillId)?.mechanic
      check(!a.death && a.action?.id === h.skillId && ((h.kind === 'charge' && card?.kind === 'plinth-blow') ||
        (h.kind === 'channel' && card?.kind === 'rill-fan')) && integer(h.button) && [1, 2, 8, 16, 32, 64].includes(h.button) &&
        integer(h.eligibleTicks) && h.eligibleTicks <= world.tick - a.action.startTick + 1 &&
        h.eligibleTicks <= (card.kind === 'plinth-blow' ? card.autoReleaseAt : card.maxPulses * card.pulseTicks +
          a.action.recipe!.timing.windupTicks) && typeof h.releasePending === 'boolean', 'held phase')
    }
    if (a.ai) {
      const card = world.content.enemies.find(e => e.id === a.ai!.enemyId)!
      check((a.ai.trait === undefined || (TRAITS.includes(a.ai.trait) && card.traits?.includes(a.ai.trait))) &&
        (a.ai.bossPhase === undefined || (card.boss && [1, 2].includes(a.ai.bossPhase))), 'AI trait/phase')
      const ids = a.ai.committedEffectIds
      check(ids === undefined || (Array.isArray(ids) && unique(ids) && ids.every(id => world.effects.some(e =>
        e.id === id && e.ownerId === a.id && e.kind === 'warning'))), 'AI commitments')
    }
  }
}

export function inspectM3Zone(world: M3World): QueryResult<ZoneInspection> {
  if (world.zoneId !== null || world.scenario === 'm3-act1') return { ok: false, reason: 'unsupported' }
  const warnings = world.effects.filter(e => e.kind === 'warning').map(e => ({
    id: e.id, sourceId: e.ownerId, startTick: e.startTick, dueTick: e.dueTick, footprint: structuredClone(e.footprint)
  }))
  return { ok: true, value: { zoneId: 'm3a-clearing', version: 1, cells: [], width: 0, height: 0,
    interactables: [], nextObjective: null, warnings } }
}
