import { TICK_HZ } from '../../sim/core/types'
import type { DamageValues, M3ActionDefinition, M3FoldDefinition } from '../../sim/core/types'
import { SHORTBLADE_WEIGHT } from '../m2/items'

type Drawing = Pick<M3ActionDefinition, 'id' | 'name' | 'tags' | 'weaponCoefficient' | 'reach' | 'familyId' | 'mechanic'> & {
  phases: [windup: number, active: number, recovery: number]
  baseDamage?: Partial<DamageValues>
} & ({ angle: number } | { speed: number; radius: number })

const drawings: Drawing[] = [
  {
    id: 'span-cut', name: 'Span Cut', familyId: 'hemblade', tags: ['weapon', 'melee', 'area'],
    weaponCoefficient: 1, reach: 1.7, angle: 100, phases: [6, 3, 12],
    mechanic: { kind: 'span-cut', maxSeams: 2, refreshTicks: 120 }
  },
  {
    id: 'open-hem', name: 'Open Hem', familyId: 'hemblade', tags: ['weapon', 'melee', 'area'],
    weaponCoefficient: 1.5, reach: 2.4, angle: 180, phases: [4, 6, 16],
    mechanic: { kind: 'open-hem', seamCost: 2, stepTicks: 6, halfWidth: .45 }
  },
  {
    id: 'plinth-blow', name: 'Plinth Blow', familyId: 'plumbshoe', tags: ['weapon', 'melee', 'area'],
    weaponCoefficient: 1, reach: 1.4, angle: 360, phases: [4, 1, 20],
    mechanic: { kind: 'plinth-blow', chargedAt: 24, autoReleaseAt: 45, chargedCoefficient: 1.75, rootTicks: 24 }
  },
  {
    id: 'brace-mark', name: 'Brace Mark', familyId: 'plumbshoe', tags: ['weapon', 'melee', 'area'],
    weaponCoefficient: 1, reach: 2, angle: 180, phases: [3, 10, 18],
    mechanic: { kind: 'brace-mark', incomingFactor: .5, answerReach: 2, answerRadius: .8 }
  },
  {
    id: 'cast-loop', name: 'Cast Loop', familyId: 'verge-reel', tags: ['weapon', 'projectile'],
    weaponCoefficient: .75, reach: 7, speed: 10, radius: .16, phases: [5, 1, 10],
    mechanic: { kind: 'cast-loop', eyeLifetime: 150 }
  },
  {
    id: 'gather-line', name: 'Gather Line', familyId: 'verge-reel', tags: ['weapon', 'projectile'],
    weaponCoefficient: 1, reach: 7, speed: 14, radius: .2, phases: [2, 1, 10],
    mechanic: { kind: 'gather-line', stitchFactor: .5, stitchReach: 2 }
  },
  {
    id: 'lay-bed', name: 'Lay Bed', familyId: 'hearth-frame', tags: ['weapon', 'area'],
    weaponCoefficient: .5, baseDamage: { heat: 16 }, reach: 4, angle: 180, phases: [6, 1, 12],
    mechanic: { kind: 'lay-bed', radius: .9, armTicks: 18, expiryTicks: 180 }
  },
  {
    id: 'lift-print', name: 'Lift Print', familyId: 'hearth-frame', tags: ['weapon', 'area'],
    weaponCoefficient: .75, reach: 5, angle: 180, phases: [5, 1, 14],
    mechanic: { kind: 'lift-print', halfWidth: .35, impressionHeat: 16, impressionRadius: 1.5 }
  },
  {
    id: 'fold-dart', name: 'Fold Dart', familyId: 'survey-tally', tags: ['cast', 'projectile'],
    weaponCoefficient: 0, baseDamage: { weight: 16 }, reach: 10, speed: 14, radius: .12, phases: [8, 1, 15],
    mechanic: { kind: 'fold-dart' }
  },
  {
    id: 'rill-fan', name: 'Rill Fan', familyId: 'survey-tally', tags: ['cast', 'area'],
    weaponCoefficient: 0, baseDamage: { gale: 16 }, reach: 4, angle: 180, phases: [6, 1, 18],
    mechanic: { kind: 'rill-fan', halfWidth: .6, pulseTicks: 15, maxPulses: 4, maxTurnDegrees: 15 }
  }
]

export const actions: M3ActionDefinition[] = drawings.map(({ phases, baseDamage, ...drawing }) => {
  const [windupTicks, activeTicks, recoveryTicks] = phases
  const typed = { weight: 0, heat: 0, gale: 0, ...baseDamage }
  const { id, name, tags, weaponCoefficient, reach, familyId, mechanic } = drawing
  const common = {
    id, name, tags, weaponCoefficient, reach, familyId, mechanic, baseDamage: typed,
    damage: SHORTBLADE_WEIGHT * weaponCoefficient + typed.weight + typed.heat + typed.gale,
    timing: { windupTicks, activeTicks, recoveryTicks, moveCancelTicks: recoveryTicks },
    cooldownTicks: 0, knockback: { speed: .25 * TICK_HZ / 4, ticks: 4 }, impactPauseTicks: 2, hitFlashTicks: 6
  }
  return 'angle' in drawing
    ? { ...common, kind: 'melee', range: reach, arcRadians: drawing.angle * Math.PI / 180 }
    : { ...common, kind: 'projectile', speed: drawing.speed, radius: drawing.radius, lifetimeTicks: Math.ceil(TICK_HZ * reach / drawing.speed) }
})

const pleats: Pick<M3FoldDefinition, 'id' | 'name' | 'handle' | 'tension' | 'whitelist' | 'mechanic'>[] = [
  {
    id: 'splay-pleat', name: 'Splay Pleat', handle: 'spread', tension: 1, whitelist: ['fold-dart'],
    mechanic: { kind: 'splay', angles: [-18, 0, 18], primaryFactor: .45 }
  },
  {
    id: 'through-pleat', name: 'Through Pleat', handle: 'reach', tension: 2, whitelist: ['fold-dart', 'lift-print'],
    mechanic: { kind: 'through', maxContacts: 2, primaryFactor: .7 }
  },
  {
    id: 'after-pleat', name: 'After Pleat', handle: 'material', tension: 2, whitelist: ['span-cut', 'plinth-blow', 'brace-mark'],
    mechanic: { kind: 'after', delayTicks: 18, primaryFactor: .5, echoFactor: .5 }
  },
  {
    id: 'hinge-pleat', name: 'Hinge Pleat', handle: 'reach', tension: 2, whitelist: ['cast-loop', 'open-hem'],
    mechanic: { kind: 'hinge', retraceFraction: .5, primaryFactor: .75, returnFactor: .5 }
  },
  {
    id: 'rim-pleat', name: 'Rim Pleat', handle: 'spread', tension: 1, whitelist: ['lay-bed', 'rill-fan'],
    mechanic: { kind: 'rim', offset: .8, tileRadius: .6, laneHalfWidth: .3, primaryFactor: .75 }
  },
  {
    id: 'catch-pleat', name: 'Catch Pleat', handle: 'material', tension: 1, whitelist: ['gather-line', 'lay-bed', 'lift-print'],
    mechanic: { kind: 'catch', delayTicks: 12, radius: .8, expiryTicks: 60, primaryFactor: .8, entrantFactor: .5 }
  }
]

export const folds: M3FoldDefinition[] = pleats.map(pleat => ({
  ...pleat, compatibility: 'any', modifiers: [], reachFactor: 1, arcFactor: 1, radiusFactor: 1,
  windupDelta: 0, recoveryDelta: 0, projectileAngles: pleat.mechanic.kind === 'splay' ? [...pleat.mechanic.angles] : [0]
}))
