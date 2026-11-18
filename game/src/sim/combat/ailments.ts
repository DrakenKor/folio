import type { AilmentRule, DamageValues, EntityId, QueryResult, SimEvent, World } from '../core/types'
import { kill } from './death'
import { actorStats, byId } from './stats'

export const AILMENT_RULES = [
  { id: 'burden', damageType: 'weight', threshold: 12, durationTicks: 90, pulseTicks: null, pulseBase: null },
  { id: 'emberprint', damageType: 'heat', threshold: 12, durationTicks: 120, pulseTicks: 30, pulseBase: 2 },
  { id: 'draftbind', damageType: 'gale', threshold: 12, durationTicks: 90, pulseTicks: null, pulseBase: null }
] as const satisfies readonly AilmentRule[]

const ember = AILMENT_RULES[1]

export function applyAilments(world: World, sourceId: EntityId, targetId: EntityId, damage: DamageValues): void {
  for (const rule of AILMENT_RULES) {
    if (damage[rule.damageType] < rule.threshold) continue
    const times = { sourceId, targetId, appliedTick: world.tick, expiresTick: world.tick + rule.durationTicks }
    const existing = world.ailments.find(ailment => ailment.targetId === targetId && ailment.id === rule.id)
    if (existing) Object.assign(existing, times)
    else {
      world.ailments.push(rule.id === 'emberprint' ? { ...times, id: rule.id, nextPulseTick: world.tick + rule.pulseTicks } :
        { ...times, id: rule.id, nextPulseTick: null })
      world.ailments.sort((a, b) => a.targetId - b.targetId || byId(a, b))
    }
  }
}

export function processAilments(world: World, events: SimEvent[]): QueryResult<null> {
  for (const ailment of world.ailments) {
    if (ailment.id !== 'emberprint' || ailment.nextPulseTick !== world.tick) continue
    const target = world.entities.find(actor => actor.id === ailment.targetId)
    if (!target || target.death) continue
    ailment.nextPulseTick += ember.pulseTicks
    const reduction = actorStats(world, target).reductions.heat
    const amount = Math.min(target.health, Math.floor(ember.pulseBase * (1 - reduction) + .5))
    target.health -= amount
    events.push({ type: 'damage', tick: world.tick, actorId: ailment.sourceId, targetId: target.id, skillId: ailment.id,
      amount, health: target.health, position: { ...target.pos } })
    if (target.health === 0) kill(world, target, ailment.sourceId, events)
  }
  if (world.ailments.length) world.ailments = world.ailments.filter(ailment => ailment.expiresTick > world.tick)
  return { ok: true, value: null }
}
