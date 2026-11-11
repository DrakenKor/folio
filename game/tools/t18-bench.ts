import { writeFileSync } from 'node:fs'
import { cpus, totalmem } from 'node:os'
import { step } from '../src/sim/core'
import { IDLE_COMMAND } from '../src/sim/core/types'
import { buildScenario } from '../src/sim/scenarios'

const reports = ['m1-stress', 'dummies-1000'].map(scenario => {
  const warm = buildScenario(scenario, 7)
  for (let tick = 0; tick < 120; tick++) step(warm, IDLE_COMMAND)
  const world = buildScenario(scenario, 7)
  const intervals = []
  let peakProjectiles = world.projectiles.length
  for (let tick = 0; tick < 600; tick++) {
    const start = performance.now()
    step(world, IDLE_COMMAND)
    intervals.push(performance.now() - start)
    peakProjectiles = Math.max(peakProjectiles, world.projectiles.length)
  }
  const sorted = [...intervals].sort((a, b) => a - b)
  return { scenario, seed: 7, warmupTicks: 120, samples: intervals.length, median: sorted[299], p95: sorted[569],
    actors: world.entities.length, peakProjectiles, intervals }
})
writeFileSync('game/.play-out/t18/checks/bench.json', JSON.stringify({ node: process.version,
  hardware: { cpu: cpus()[0]?.model, memoryBytes: totalmem() }, reports }, null, 2))
console.log(JSON.stringify(reports.map(({ intervals: _intervals, ...report }) => report)))
