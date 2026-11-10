import { rngFloat } from './core/rng'
import { createWorld, spawnEntity } from './core/store'
import type { World } from './core/types'

export const SIM_BUILD = 'm0-sim-v1'
export const SCENARIO_NAMES = ['empty', 'meadow-start', 'dummies-1000'] as const

/** Build a fresh deterministic fixture without ambient state or presentation data. */
export function buildScenario(name: string, seed: number): World {
  if (!SCENARIO_NAMES.some(candidate => candidate === name)) throw new RangeError(`Unknown scenario: ${name}`)
  const world = createWorld(seed, SIM_BUILD)
  if (name === 'empty') return world
  spawnEntity(world, { kind: 'player', pos: { x: 0, z: 0 }, radius: 0.4 })
  const count = name === 'meadow-start' ? 12 : 1000
  const columns = name === 'meadow-start' ? 4 : 32
  for (let i = 0; i < count; i++) {
    spawnEntity(world, {
      kind: 'dummy', radius: 0.4,
      pos: {
        x: 4 + (i % columns) * 2 + rngFloat(world, 'scenario') * 0.5,
        z: (Math.floor(i / columns) - Math.floor(count / columns) / 2) * 2 + rngFloat(world, 'scenario') * 0.5
      }
    })
  }
  return world
}
