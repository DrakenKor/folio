import { spawnSync } from 'node:child_process'
import { performance } from 'node:perf_hooks'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { buildScenario } from '../src/sim/scenarios'
import { hashWorld } from '../src/sim/core/hash'
import { step } from '../src/sim/core/loop'
import { IDLE_COMMAND } from '../src/sim/core/types'
import type { Command } from '../src/sim/core/types'

const tool = fileURLToPath(new URL('./sim.ts', import.meta.url))

function cli(args: string[], input?: string) {
  return spawnSync(process.execPath, ['--import', 'tsx', tool, ...args], { encoding: 'utf8', input })
}

describe('headless CLI', () => {
  it('8: prints the same meadow tick-3,600 hash on two runs', () => {
    const args = ['--scenario', 'meadow-start', '--seed', '7', '--ticks', '3600']
    const first = cli(args)
    const second = cli(args)
    expect(first.status, first.stderr).toBe(0)
    expect(second.status, second.stderr).toBe(0)
    expect(first.stdout).toBe(second.stdout)
    expect(JSON.parse(first.stdout)).toMatchObject({ tick: 3600, entities: 13, hash: expect.stringMatching(/^[0-9a-f]{8}$/) })
  })

  it('holds scripted commands until the next entry and idles before the first', () => {
    const forward: Command = { move: { x: 1, z: 0 }, aim: null, buttons: 0 }
    const script = [{ tick: 2, command: forward }, { tick: 8, command: IDLE_COMMAND }]
    const result = cli(['--scenario', 'meadow-start', '--seed', '7', '--ticks', '11', '--script', '/dev/stdin'], JSON.stringify(script))
    expect(result.status, result.stderr).toBe(0)
    const world = buildScenario('meadow-start', 7)
    while (world.tick < 11) step(world, world.tick >= 2 && world.tick < 8 ? forward : IDLE_COMMAND)
    expect(JSON.parse(result.stdout)).toEqual({ tick: 11, hash: hashWorld(world), entities: 13 })
  })

  it('rejects invalid flags, tick counts, scenarios and scripts', () => {
    for (const args of [
      ['--scenario', 'unknown', '--seed', '7', '--ticks', '1'],
      ['--scenario', 'empty', '--seed', '7', '--ticks', '-1'],
      ['--scenario', 'empty', '--seed', '7', '--ticks', '1.5'],
      ['--scenario', 'empty', '--seed', '7', '--ticks', '1', '--wat'],
      ['--scenario', 'empty', '--seed', '7']
    ]) {
      const result = cli(args)
      expect(result.status).not.toBe(0)
      expect(result.stderr.length).toBeGreaterThan(0)
      expect(result.stdout).toBe('')
    }
    const malformed = cli(['--scenario', 'empty', '--seed', '7', '--ticks', '1', '--script', '/dev/stdin'], '[{"tick":-1}]')
    expect(malformed.status).not.toBe(0)
  })
})

it('measures the median tick time for 1,000 dummies over 600 ticks in Node', () => {
  const world = buildScenario('dummies-1000', 7)
  const timings: number[] = []
  for (let i = 0; i < 600; i++) {
    const start = performance.now()
    step(world, IDLE_COMMAND)
    timings.push(performance.now() - start)
  }
  timings.sort((a, b) => a - b)
  const median = (timings[299]! + timings[300]!) / 2
  process.stdout.write(`${JSON.stringify({ scenario: 'dummies-1000', ticks: world.tick, medianTickMs: median, targetMs: 2 })}\n`)
  expect(world.tick).toBe(600)
})
