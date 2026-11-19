import assert from 'node:assert/strict'
import { buildScenario } from '../src/sim/scenarios'
import type { M2Content, World } from '../src/sim/core'

/** The shared item, graph and recipe tables are present on both public content profiles. */
export function profile(world: World): M2Content {
  const tables = Reflect.get(world.content, 'm3') ?? world.content.m2
  assert(tables && Array.isArray(tables.actions) && Array.isArray(tables.itemBases), 'player clearing publishes its build content')
  return tables
}

/** Only the unregistered baseline name falls back. A partially wired M3 registry fails explicitly. */
export function clearing(seed = 7): World {
  let world: World
  try { world = buildScenario('m3a-clearing', seed) }
  catch (error) {
    if (error instanceof RangeError && error.message === 'Unknown scenario: m3a-clearing') return buildScenario('m2-clearing', seed)
    if (error instanceof Error && 'reason' in error && error.reason === 'unsupported') assert.fail('M3a clearing must offer a playable starter at rest')
    throw error
  }
  assert(world.entities.some(e => e.id === world.playerId && e.character), 'M3a clearing must offer a playable starter at rest')
  profile(world)
  return world
}
