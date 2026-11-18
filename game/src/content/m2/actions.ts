import { TICK_HZ } from '../../sim/core/types'
import type { ActionDefinition } from '../schema'
import { SHORTBLADE_WEIGHT } from './items'

type ActionCard = Pick<ActionDefinition, 'id' | 'name' | 'tags' | 'baseDamage' | 'weaponCoefficient' | 'reach'> & {
  phases: [windup: number, active: number, recovery: number]
} & ({ angle: number } | { speed: number; radius: number })

const CARDS: ActionCard[] = [
  {
    id: 'span-cut', name: 'Span Cut', tags: ['weapon', 'melee', 'area'],
    baseDamage: { weight: 0, heat: 0, gale: 0 }, weaponCoefficient: 1, reach: 1.7, angle: 100, phases: [6, 3, 12]
  },
  {
    id: 'fold-dart', name: 'Fold Dart', tags: ['cast', 'projectile'],
    baseDamage: { weight: 16, heat: 0, gale: 0 }, weaponCoefficient: 0, reach: 10, speed: 14, radius: .12, phases: [8, 1, 15]
  },
  {
    id: 'rill-fan', name: 'Rill Fan', tags: ['cast', 'area'],
    baseDamage: { weight: 0, heat: 0, gale: 18 }, weaponCoefficient: 0, reach: 3, angle: 70, phases: [12, 1, 20]
  },
  {
    id: 'plinth-blow', name: 'Plinth Blow', tags: ['weapon', 'melee', 'area'],
    baseDamage: { weight: 0, heat: 0, gale: 0 }, weaponCoefficient: 1.5, reach: 2.2, angle: 50, phases: [14, 3, 24]
  },
  {
    id: 'hearth-shard', name: 'Hearth Shard', tags: ['cast', 'projectile'],
    baseDamage: { weight: 0, heat: 20, gale: 0 }, weaponCoefficient: 0, reach: 8, speed: 10, radius: .16, phases: [12, 1, 21]
  },
  {
    id: 'skim-needle', name: 'Skim Needle', tags: ['cast', 'projectile'],
    baseDamage: { weight: 0, heat: 0, gale: 12 }, weaponCoefficient: 0, reach: 12, speed: 20, radius: .10, phases: [5, 1, 12]
  },
  {
    id: 'sill-rake', name: 'Sill Rake', tags: ['weapon', 'melee', 'area'],
    baseDamage: { weight: 0, heat: 0, gale: 0 }, weaponCoefficient: 1, reach: 2.3, angle: 60, phases: [8, 3, 16]
  },
  {
    id: 'cairn-wake', name: 'Cairn Wake', tags: ['cast', 'area'],
    baseDamage: { weight: 10, heat: 10, gale: 0 }, weaponCoefficient: 0, reach: 2, angle: 360, phases: [16, 1, 25]
  }
]

export const actions: ActionDefinition[] = CARDS.map(({ phases, ...card }) => {
  const [windupTicks, activeTicks, recoveryTicks] = phases
  const { weight, heat, gale } = card.baseDamage
  const { id, name, tags, baseDamage, weaponCoefficient, reach } = card
  const common = {
    id, name, tags, baseDamage, weaponCoefficient, reach,
    timing: { windupTicks, activeTicks, recoveryTicks, moveCancelTicks: 6 },
    cooldownTicks: 0,
    // The inherited fixed-damage field describes the unmodified card with a Shortblade.
    damage: weight + heat + gale + SHORTBLADE_WEIGHT * weaponCoefficient,
    knockback: { speed: .25 * TICK_HZ / 4, ticks: 4 }, impactPauseTicks: 2, hitFlashTicks: 6
  }
  return 'angle' in card
    ? { ...common, kind: 'melee', range: reach, arcRadians: card.angle * Math.PI / 180 }
    : { ...common, kind: 'projectile', speed: card.speed, radius: card.radius, lifetimeTicks: Math.ceil(TICK_HZ * reach / card.speed) }
})
