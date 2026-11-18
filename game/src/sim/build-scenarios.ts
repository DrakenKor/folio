import schedule from '../../scenarios/m2-balance.json'
import { buildScenario, spawnCreaseback } from './scenarios'
import type { SimEvent, World } from './core/types'

/** Publish exactly the trio and positions frozen for this evaluation seed and tick. */
export function spawnBalanceWave(world: World): SimEvent[] {
  if (world.tick % schedule.waveTicks !== 0 || world.tick >= schedule.ticks) return []
  const waves = schedule.seeds[String(world.seed) as keyof typeof schedule.seeds]
  if (!waves) throw new RangeError('Balance seeds are frozen to 1–10')
  const wave = waves[world.tick / schedule.waveTicks]!
  return wave.positions.map(pos => {
    const actor = spawnCreaseback(world, pos)
    return { type: 'spawn', tick: world.tick, id: actor.id, kind: actor.kind }
  })
}

export function buildBalanceScenario(seed: number): World {
  const world = buildScenario('m2-clearing', seed)
  world.scenario = 'm2-balance'
  world.encounter = { id: world.scenario, phase: 'active', attempt: 1, rewardedIds: [] }
  spawnBalanceWave(world)
  return world
}
