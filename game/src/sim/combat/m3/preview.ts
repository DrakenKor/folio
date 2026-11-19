import { sharedBuildView } from '../../core/profile'
import { TICK_HZ } from '../../core/types'
import type { ActionPreview, Entity, M3ActionDefinition, M3ActionPreview, M3BuildPreview, M3World, PreviewPath, ResolvedAction } from '../../core/types'
import { calculateDamage } from '../damage-model'
import { multiply } from '../decimal'
import { actorStats } from '../stats'
import { chargedRecipe, foldOf, price, scaled } from './records'

interface DrawingPath extends PreviewPath {
  damage: number
  angleDegrees?: number
  lateralOffset?: number
  startDistance?: number
  maxContacts?: number
  lifetimeTicks?: number
  chargedAt?: number
  autoReleaseAt?: number
  trigger?: 'catch' | 'occupancy' | 'entry' | 'emberprint' | 'draftbind'
}
export interface DrawingPreview extends M3ActionPreview {
  paths: DrawingPath[]
}
export interface DrawingBuildPreview extends M3BuildPreview {
  actions: Array<{ skillId: string; before: DrawingPreview; after: DrawingPreview }>
}

export function previewDrawing(world: M3World, actor: Entity, target: Entity, card: M3ActionDefinition,
  base: ActionPreview, lockedReason: M3ActionPreview['lockedReason']): DrawingPreview {
  const r = base.recipe, m = card.mechanic, f = r.footprint
  const reductions = actorStats(sharedBuildView(world), target, r.tags).reductions
  const amount = (recipe: ResolvedAction, factor: number) => calculateDamage(scaled(recipe, factor), reductions, target.health)
  const factor = price(world, r)
  const damage = amount(r, factor)
  const full = m.kind === 'plinth-blow' ? chargedRecipe(world, actor, r) : r
  const primary = amount(full, factor).applied

  const path: DrawingPath = { role: 'primary', shape: f.kind === 'projectile' ? 'path' : 'sector', reach: f.reach,
    radius: f.radius, arcRadians: f.arcRadians, halfWidth: 0, delayTicks: r.timing.windupTicks, damage: primary }
  if ('halfWidth' in m) { path.shape = 'lane'; path.halfWidth = m.halfWidth }
  if (m.kind === 'plinth-blow') {
    path.shape = 'disc'; path.radius = f.reach
    path.chargedAt = m.chargedAt; path.autoReleaseAt = m.autoReleaseAt
  }
  if (m.kind === 'brace-mark') {
    path.shape = 'disc'; path.radius = m.answerRadius; path.reach = m.answerReach; path.trigger = 'catch'
  }
  if (m.kind === 'lay-bed') {
    path.shape = 'disc'; path.radius = m.radius; path.delayTicks += m.armTicks
    path.trigger = 'occupancy'; path.lifetimeTicks = m.expiryTicks
  }
  if (m.kind === 'cast-loop') path.lifetimeTicks = m.eyeLifetime
  const catcher = foldOf(world, r, 'catch'), hinge = foldOf(world, r, 'hinge'), after = foldOf(world, r, 'after')
  const through = foldOf(world, r, 'through'), rim = foldOf(world, r, 'rim')
  if (catcher) path.delayTicks += catcher.delayTicks
  if (m.kind === 'fold-dart' || m.kind === 'lift-print') path.maxContacts = through?.maxContacts ?? 1

  let paths = [path]
  if (f.projectileAngles.length > 1) paths = f.projectileAngles.map(angleDegrees => ({ ...path, angleDegrees }))
  if (rim) paths = [-rim.offset, rim.offset].map(lateralOffset => ({ ...path, lateralOffset,
    radius: path.shape === 'disc' ? rim.tileRadius : path.radius,
    halfWidth: path.shape === 'lane' ? rim.laneHalfWidth : path.halfWidth }))
  if (m.kind === 'rill-fan') {
    const lanes = paths
    paths = Array.from({ length: m.maxPulses }, (_, i) =>
      lanes.map(lane => ({ ...lane, delayTicks: lane.delayTicks + i * m.pulseTicks }))).flat()
  }

  if (after) paths.push({ ...path, role: 'secondary', delayTicks: path.delayTicks + after.delayTicks,
    damage: amount(full, after.echoFactor).applied })
  if (hinge) {
    const travelTicks = m.kind === 'open-hem' ? m.stepTicks : Math.ceil(f.reach / f.speed * TICK_HZ)
    paths.push({ ...path, role: 'secondary', angleDegrees: 180, startDistance: f.reach, reach: f.reach * hinge.retraceFraction,
      delayTicks: path.delayTicks + travelTicks, damage: amount(r, hinge.returnFactor).applied })
  }
  if (catcher) paths.push({ ...path, role: 'secondary', shape: 'disc', trigger: 'entry', radius: catcher.radius,
    halfWidth: 0, reach: 0, maxContacts: 1, delayTicks: path.delayTicks + 1,
    lifetimeTicks: catcher.expiryTicks, damage: amount(r, catcher.entrantFactor).applied })

  // Each entry prices one contact on this defence profile. Overlapping pieces share a hit.
  const direct = Array<number>(through?.maxContacts ?? (m.kind === 'rill-fan' ? m.maxPulses : 1)).fill(primary)
  const clean = [...direct, ...paths.filter(p => p.role === 'secondary').map(p => p.damage)]
  let condition: DrawingPreview['condition'] = null
  let payoff: DrawingPreview['payoff'] = null
  if (m.kind === 'plinth-blow') {
    condition = 'burden'
    payoff = { rootTicks: m.rootTicks }
  } else if (m.kind === 'lift-print') {
    condition = 'emberprint'
    const impression = { ...r, sourceDamage: { weight: 0, heat: m.impressionHeat, gale: 0 } }
    payoff = { secondaryDamage: amount(impression, 1).applied }
    paths.push({ ...path, role: 'secondary', trigger: condition, shape: 'disc', reach: 0,
      halfWidth: 0, radius: m.impressionRadius, maxContacts: undefined, damage: payoff.secondaryDamage })
  } else if (m.kind === 'gather-line') {
    condition = 'draftbind'
    payoff = { secondaryDamage: amount(r, multiply(factor, m.stitchFactor)).applied }
    paths.push({ ...path, role: 'secondary', trigger: condition, reach: m.stitchReach, maxContacts: 1, damage: payoff.secondaryDamage })
  }
  return { ...base, damage, condition, payoff, paths, lockedReason, requiredItem: card.familyId,
    cost: { tension: world.content.m3.folds.filter(fold => r.folds.includes(fold.id)).reduce((sum, fold) => sum + fold.tension, 0),
      seams: m.kind === 'open-hem' ? m.seamCost : 0 },
    conditionalDamage: { clean, prepared: payoff && 'secondaryDamage' in payoff ? [...clean, payoff.secondaryDamage] : [...clean] } }
}
