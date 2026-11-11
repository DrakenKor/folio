import type { CombatContent } from '../sim/core/types'

/** Approved M1 content; each world receives a detached copy. */
const CONTENT: CombatContent = {
  skills: [
    {
      id: 'creaseback-strike', kind: 'melee', damage: 20, range: 1.4, arcRadians: 70 * Math.PI / 180,
      timing: { windupTicks: 24, activeTicks: 3, recoveryTicks: 24, moveCancelTicks: 24 },
      cooldownTicks: 0, knockback: { speed: 0.15 * 60 / 4, ticks: 4 }, impactPauseTicks: 2, hitFlashTicks: 6
    },
    {
      id: 'fold-dart', kind: 'projectile', damage: 16, speed: 14, radius: 0.12, lifetimeTicks: 43,
      timing: { windupTicks: 8, activeTicks: 1, recoveryTicks: 15, moveCancelTicks: 6 },
      cooldownTicks: 0, knockback: { speed: 0.25 * 60 / 4, ticks: 4 }, impactPauseTicks: 2, hitFlashTicks: 6
    },
    {
      id: 'span-cut', kind: 'melee', damage: 24, range: 1.7, arcRadians: 100 * Math.PI / 180,
      timing: { windupTicks: 6, activeTicks: 3, recoveryTicks: 12, moveCancelTicks: 6 },
      cooldownTicks: 0, knockback: { speed: 0.25 * 60 / 4, ticks: 4 }, impactPauseTicks: 2, hitFlashTicks: 6
    }
  ],
  enemies: [
    { id: 'creaseback', maxHealth: 72, radius: 0.45, moveSpeed: 1.8, acquireRange: 8, attackRange: 1.2,
      skillId: 'creaseback-strike', deathTicks: 30 }
  ],
  dodge: {
    timing: { windupTicks: 0, activeTicks: 10, recoveryTicks: 8, moveCancelTicks: 8 },
    distance: 3, cooldownTicks: 30, invulnerableFrom: 2, invulnerableUntil: 8
  }
}

export const WINDSTEP_CLEARING = {
  id: 'windstep-clearing', arena: { center: { x: 0, z: 0 }, radius: 8 },
  player: { pos: { x: -3, z: 0 }, maxHealth: 120, radius: 0.32 },
  enemies: [{ x: 2, z: 0 }, { x: 3, z: 2 }, { x: 3, z: -2 }],
  waveTicks: 600, fightTicks: 7200
} as const

export function m1Content(): CombatContent { return structuredClone(CONTENT) }
