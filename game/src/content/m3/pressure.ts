import pressure from '../../../scenarios/m3a-pressure.json'
import type { EnemyDefinition, Footprint, SkillDefinition } from '../../sim/core/types'

type PressureCard = Pick<EnemyDefinition, 'id' | 'maxHealth' | 'radius' | 'moveSpeed' | 'attackRange'> & {
  damage: number
  windup: number
  recovery: number
  footprint: Pick<Footprint, 'kind'> & Partial<Pick<Footprint, 'reach' | 'arcRadians' | 'halfWidth' | 'radius'>>
}

const cards: PressureCard[] = [
  { id: 'creaseback', maxHealth: 72, radius: .45, moveSpeed: 1.8, attackRange: 1.4, damage: 38,
    windup: 24, recovery: 30, footprint: { kind: 'sector', reach: 1.4, arcRadians: 70 * Math.PI / 180 } },
  { id: 'furrow-skater', maxHealth: 64, radius: .36, moveSpeed: 2.1, attackRange: 5, damage: 40,
    windup: 36, recovery: 36, footprint: { kind: 'lane', reach: 5, halfWidth: .45 } },
  { id: 'silt-bell', maxHealth: 64, radius: .45, moveSpeed: 1.2, attackRange: 4.5, damage: 62,
    windup: 48, recovery: 42, footprint: { kind: 'disc', radius: .85 } }
]

export const enemies: EnemyDefinition[] = cards.map(({ id, maxHealth, radius, moveSpeed, attackRange, windup, recovery, footprint }) => ({
  id, maxHealth, radius, moveSpeed, attackRange, acquireRange: 8, deathTicks: 30, skillId: `${id}-strike`,
  warnings: [{
    delayTicks: windup, recoveryTicks: recovery,
    footprint: { origin: { x: 0, z: 0 }, direction: 0, reach: 0, arcRadians: 0, halfWidth: 0, radius: 0, ...footprint }
  }]
}))

export const skills: SkillDefinition[] = cards.map(({ id, damage, attackRange, windup, recovery, footprint }) => ({
  id: `${id}-strike`, kind: 'melee', damage, range: footprint.reach ?? attackRange,
  arcRadians: footprint.arcRadians ?? Math.PI,
  timing: { windupTicks: windup, activeTicks: 1, recoveryTicks: recovery, moveCancelTicks: recovery },
  cooldownTicks: 0, knockback: { speed: 2.25, ticks: 4 }, impactPauseTicks: 2, hitFlashTicks: 6
}))

/** Marker-relative sockets. Seeds outside the frozen matrix use the authored origins. */
export function pressurePack(seed: number) {
  const offsets = pressure.offsets[seed.toString() as keyof typeof pressure.offsets]
  return pressure.pack.map((enemyId, i) => {
    const origin = pressure.origins[i]!
    const offset = offsets?.[i]
    return { enemyId, offset: {
      x: origin[0]! + (offset?.[0] ?? 0) * pressure.offsetUnit,
      z: origin[1]! + (offset?.[1] ?? 0) * pressure.offsetUnit
    } }
  })
}
