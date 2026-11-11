import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { expect, it } from 'vitest'
import { hashWorld, step } from '../src/sim/core'
import type { Command } from '../src/sim/core/types'
import { buildScenario } from '../src/sim/scenarios'

it('browser chunks consume exactly the authored 7200 commands and verify all 121 hashes', () => {
  const browser = JSON.parse(readFileSync(new URL('../scenarios/m1-fight-browser.json', import.meta.url), 'utf8'))
  const entries = JSON.parse(readFileSync(new URL('../scenarios/m1-fight-commands.json', import.meta.url), 'utf8'))
  const expected = JSON.parse(readFileSync(new URL('../scenarios/m1-fight.json', import.meta.url), 'utf8'))
  const world = buildScenario(browser.scenario, browser.seed)
  const consumed: Command[] = []
  const hashes: Array<[number, string]> = []
  const context = { window: {}, __game: {
    simulate(script: typeof entries, ticks: number) {
      for (let i = 0; i < ticks; i++) {
        const command = script.findLast((entry: { tick: number }) => entry.tick <= world.tick).command
        consumed.push(command)
        step(world, command)
      }
    }, state: () => world.tick, hash: () => hashWorld(world)
  } }
  context.window = context
  for (const instruction of browser.steps) {
    if (instruction.op === 'eval') {
      const result = runInNewContext(instruction.expression, context)
      if ('expect' in instruction) expect(result).toEqual(instruction.expect)
    }
    if (instruction.op === 'expectHash') {
      expect(hashWorld(world)).toBe(instruction.hash)
      hashes.push([world.tick, instruction.hash])
    }
  }
  expect(consumed).toHaveLength(7200)
  expect(consumed).toEqual(Array.from({ length: 7200 }, (_, tick) => entries.findLast((entry: { tick: number }) => entry.tick <= tick).command))
  expect(hashes).toEqual(expected.checkpoints)
  expect(hashWorld(world)).toBe('bec54592')
  expect(browser.steps.filter((step: { op: string }) => step.op === 'shot')).toHaveLength(7)
})
