import { readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { copyCommand } from '../src/sim/core/commands'
import { hashWorld } from '../src/sim/core/hash'
import { step } from '../src/sim/core/loop'
import { IDLE_COMMAND } from '../src/sim/core/types'
import type { Command } from '../src/sim/core/types'
import { buildScenario } from '../src/sim/scenarios'

interface ScriptEntry { tick: number; command: Command }

function integer(text: string | undefined, name: string): number {
  if (text === undefined || text.trim() === '' || !Number.isSafeInteger(Number(text))) throw new TypeError(`--${name} requires a safe integer`)
  return Number(text)
}

function scriptEntries(text: string): ScriptEntry[] {
  const entries: ScriptEntry[] = JSON.parse(text)
  if (!Array.isArray(entries)) throw new TypeError('Script must be a JSON array')
  let previous = -1
  return entries.map(entry => {
    if (!entry || !Number.isSafeInteger(entry.tick) || entry.tick <= previous) throw new TypeError('Script ticks must be nonnegative and strictly increasing')
    previous = entry.tick
    return { tick: entry.tick, command: copyCommand(entry.command) }
  })
}

try {
  const { values } = parseArgs({ options: {
    scenario: { type: 'string' }, seed: { type: 'string' },
    ticks: { type: 'string' }, script: { type: 'string' }
  } })
  if (!values.scenario) throw new TypeError('--scenario is required')
  const seed = integer(values.seed, 'seed')
  const ticks = integer(values.ticks, 'ticks')
  if (ticks < 0) throw new RangeError('--ticks must be nonnegative')
  const script = values.script ? scriptEntries(readFileSync(values.script, 'utf8')) : []
  const world = buildScenario(values.scenario, seed)
  let command: Command = IDLE_COMMAND
  let entry = 0
  while (world.tick < ticks) {
    if (script[entry]?.tick === world.tick) command = script[entry++]!.command
    step(world, command)
  }
  process.stdout.write(`${JSON.stringify({ tick: world.tick, hash: hashWorld(world), entities: world.entities.length })}\n`)
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
}
