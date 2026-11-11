import { createWorld, serialize, spawnEntity } from '../sim/core'

/** AI-free Span Cut encounter for animation verification before scenario integration. */
export function combatSnapshot(): string {
  const world = createWorld(7)
  world.content.skills = [{
    id: 'span-cut', kind: 'melee', damage: 24, range: 1.7, arcRadians: 100 * Math.PI / 180,
    timing: { windupTicks: 6, activeTicks: 3, recoveryTicks: 12, moveCancelTicks: 6 }, cooldownTicks: 0,
    knockback: { speed: 3.75, ticks: 4 }, impactPauseTicks: 2, hitFlashTicks: 6
  }]
  world.content.dodge = {
    timing: { windupTicks: 0, activeTicks: 10, recoveryTicks: 8, moveCancelTicks: 8 },
    distance: 3, cooldownTicks: 30, invulnerableFrom: 2, invulnerableUntil: 8
  }
  spawnEntity(world, { kind: 'player', pos: { x: 0, z: 0 }, radius: 0.32, health: 120, maxHealth: 120,
    skills: { primary: 'span-cut', secondary: null } })
  spawnEntity(world, { kind: 'animation-target', faction: 'hostile', pos: { x: 1.2, z: 0 }, radius: 0.45,
    health: 72, maxHealth: 72 })
  return serialize(world)
}
