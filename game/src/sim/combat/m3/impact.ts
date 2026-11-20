import type { PendingChild, PendingContact } from '../../core/m3-loop'
import { sharedBuildView } from '../../core/profile'
import type { AilmentState, Entity, Footprint, M3World, OwnedEffect, Projectile, ResolvedAction, SimEvent, Vec2 } from '../../core/types'
import { movementInput } from '../actions'
import { AILMENT_RULES, applyAilments } from '../ailments'
import { multiply } from '../decimal'
import { calculateDamage } from '../damage-model'
import { kill } from '../death'
import { actorStats } from '../stats'
import { along, distance, heading, overlap, shape, visible } from './geometry'
import { drawing, foldOf, price, record, remember, scaled } from './records'

export interface Attack {
  owner: Entity
  recipe: ResolvedAction
  origin: Vec2
  startTick: number
  effectId: number
  childOrdinal?: number
  factor: number
  secondary?: boolean
  charged?: boolean
  projectile?: Projectile
  effectKind?: OwnedEffect['kind']
  /** Return false for a spent geometric contact, including immunity. */
  accept?: (target: Entity) => boolean
  canTrigger?: () => boolean
  onPositive?: (target: Entity) => void
  catchHistory?: number[]
}

export function echo(world: M3World, owner: Entity, recipe: ResolvedAction, f: Footprint) {
  const after = foldOf(world, recipe, 'after')
  if (after) {
    const due = world.tick + after.delayTicks
    record(world, owner, recipe, 'echo', f, due, due + 1, owner.action?.startTick, 1)
  }
}

function occupants(world: M3World, owner: Entity, footprint: Footprint) {
  return world.entities.filter(t => !t.death && t.faction !== owner.faction && overlap(world, footprint, t) !== null)
}

function braceWindow(world: M3World, target: Entity, attack: Attack) {
  const a = target.action
  if (!a?.recipe) return
  const m = drawing(world, a.id)?.mechanic
  if (m?.kind !== 'brace-mark' || a.ageTicks < a.recipe.timing.windupTicks ||
    a.ageTicks >= a.recipe.timing.windupTicks + a.recipe.timing.activeTicks) return
  const window = world.effects.find(e => e.kind === 'counter' && e.ownerId === target.id)
  if (!window || window.acceptedTargetIds.length) return
  const forward = along(target.pos, a.direction, 1)
  const from = distance(target.pos, attack.origin) ? attack.origin : attack.owner.pos
  const dot = (forward.x - target.pos.x) * (from.x - target.pos.x) + (forward.z - target.pos.z) * (from.z - target.pos.z)
  if (dot < 0) return
  remember(window.acceptedTargetIds, attack.owner.id)
  return { window, m }
}

type Counter = NonNullable<ReturnType<typeof braceWindow>>
function answerBrace(world: M3World, counter: Counter, owner: Entity, striker: Entity, events: SimEvent[]) {
  if (distance(owner.pos, striker.pos) > counter.m.answerReach || !visible(world, owner.pos, striker.pos)) return []
  const f = shape('disc', striker.pos, 0, 0, 0, counter.m.answerRadius)
  const r = counter.window.recipe
  echo(world, owner, r, f)
  const attack = { ...effectAttack(world, owner, counter.window), origin: f.origin }
  return occupants(world, owner, f).map(t => contact(world, attack, t, 0, events, 1))
}

function hit(world: M3World, attack: Attack, target: Entity, events: SimEvent[], ordinal: number): PendingChild[] {
  const { owner, recipe: r } = attack, card = drawing(world, r.skillId), m = card?.mechanic
  const counter = !attack.secondary && !ordinal ? braceWindow(world, target, attack) : undefined
  const damage = calculateDamage(scaled(r, multiply(attack.factor, counter?.m.incomingFactor ?? 1)),
    actorStats(sharedBuildView(world), target, r.tags).reductions, target.health)
  const common = { tick: world.tick, actorId: owner.id, targetId: target.id, skillId: r.skillId, position: { ...target.pos } }
  events.push({ ...common, type: 'hit', actionStartTick: attack.startTick, projectileId: attack.projectile?.id ?? null })
  if (!damage.applied) return counter ? answerBrace(world, counter, target, owner, events) : []
  const triggers = !attack.secondary && (attack.canTrigger?.() ?? true)
  let condition: AilmentState['id'] | undefined
  if (triggers && m?.kind === 'plinth-blow' && attack.charged) condition = 'burden'
  if (triggers && m?.kind === 'lift-print') condition = 'emberprint'
  if (triggers && m?.kind === 'gather-line') condition = 'draftbind'
  const prepared = condition && world.ailments.find(a => a.targetId === target.id && a.id === condition)
  if (prepared) world.ailments.splice(world.ailments.indexOf(prepared), 1)

  target.health -= damage.applied
  events.push({ ...common, type: 'damage', amount: damage.applied, health: target.health })
  if (!attack.secondary) {
    const types = { ...damage.postDefence }
    if (prepared) types[AILMENT_RULES.find(rule => rule.id === prepared.id)!.damageType] = 0
    applyAilments(world, owner.id, target.id, types)
  }
  const impact = attack.projectile ?? card ?? world.content.skills.find(s => s.id === r.skillId)!
  if (!counter) {
    // A committed enemy finishes both the advertised strike and its recovery.
    if (!target.ai?.committedEffectIds && !world.content.enemies.find(e => e.id === target.ai?.enemyId)?.boss) target.action = null
    if (!target.action) target.mechanics!.held = null
    const direction = attack.projectile ? movementInput(attack.projectile.vel).direction :
      along({ x: 0, z: 0 }, heading(attack.origin, target.pos), 1)
    const vel = { x: direction.x * impact.knockback.speed, z: direction.z * impact.knockback.speed }
    target.knockback = impact.knockback.ticks ? { vel, remainingTicks: impact.knockback.ticks } : null
  }
  target.hitFlashTicks = Math.max(target.hitFlashTicks, impact.hitFlashTicks)
  target.impactPauseTicks = Math.max(target.impactPauseTicks, impact.impactPauseTicks)
  if (!attack.secondary && !attack.projectile && attack.effectKind !== 'eye') {
    owner.impactPauseTicks = Math.max(owner.impactPauseTicks, impact.impactPauseTicks)
  }
  if (!target.health) kill(world, target, owner.id, events)
  attack.onPositive?.(target)
  const children: PendingChild[] = []
  if (counter && !target.death) children.push(...answerBrace(world, counter, target, owner, events))

  if (triggers && attack.catchHistory && !attack.catchHistory.length) {
    const fold = foldOf(world, r, 'catch')
    if (fold) {
      remember(attack.catchHistory, target.id)
      const f = shape('disc', target.pos, 0, 0, 0, fold.radius)
      const mark = record(world, owner, r, 'mark', f, world.tick, world.tick + fold.expiryTicks, attack.startTick, 1)
      mark.excludedTargetIds = occupants(world, owner, f).map(t => t.id)
    }
  }
  if (!prepared) return children
  if (m?.kind === 'plinth-blow' && !target.death) target.mechanics!.rootedUntil = world.tick + m.rootTicks
  if (m?.kind !== 'lift-print' && m?.kind !== 'gather-line') return children
  const impression = m.kind === 'lift-print'
  const f = shape('disc', target.pos, 0, 0, 0, impression ? m.impressionRadius : m.stitchReach)
  let nearby = occupants(world, owner, f).filter(t => t.id !== target.id)
  if (!impression) nearby = nearby.filter(t => distance(t.pos, target.pos) <= m.stitchReach)
    .sort((a, b) => distance(a.pos, target.pos) - distance(b.pos, target.pos) || a.id - b.id).slice(0, 1)
  const secondary = impression ? { ...r, sourceDamage: { weight: 0, heat: m.impressionHeat, gale: 0 } } : r
  const effect = record(world, owner, secondary, impression ? 'impression' : 'stitch', f, world.tick, world.tick + 1, attack.startTick, 1)
  for (const t of nearby) children.push(contact(world, { owner, recipe: secondary, origin: f.origin, effectId: effect.id,
    startTick: attack.startTick, secondary: true, factor: impression ? 1 : multiply(attack.factor, m.stitchFactor) }, t, 0, events, 1))
  return children
}

export function contact(world: M3World, attack: Attack, target: Entity, travelFraction: number, events: SimEvent[], ordinal = attack.childOrdinal ?? 0): PendingContact {
  return { actorId: attack.owner.id, targetId: target.id, travelFraction, effectId: attack.effectId, childOrdinal: ordinal,
    commit({ immune }) {
      if (attack.accept && !attack.accept(target)) return
      if (!immune) return hit(world, attack, target, events, ordinal)
    } }
}

export function areaContacts(world: M3World, attack: Attack, shapes: Footprint[], events: SimEvent[], tickFraction = 1) {
  const contacts: PendingContact[] = []
  for (const t of world.entities) {
    if (t.death || t.faction === attack.owner.faction) continue
    let fraction = Infinity
    for (const f of shapes) fraction = Math.min(fraction, overlap(world, f, t) ?? Infinity)
    if (Number.isFinite(fraction)) contacts.push(contact(world, attack, t, fraction * tickFraction, events))
  }
  return contacts
}

export function effectAttack(world: M3World, owner: Entity, e: OwnedEffect): Attack {
  const startTick = world.actionGroups.find(group => group.id === e.groupId)?.actionStartTick ?? e.startTick
  return { owner, recipe: e.recipe, origin: e.footprint.origin, startTick, effectId: e.id, effectKind: e.kind,
    childOrdinal: e.childOrdinal, factor: price(world, e.recipe) }
}
