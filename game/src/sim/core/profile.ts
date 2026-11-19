import { LEGACY_SIM_BUILD, M3_BUILD, M3_SCHEMA, SCHEMA_VERSION, SIM_BUILD } from './types'
import type { CombatContent, M3World, World } from './types'

export function simulationStamp(content: CombatContent) {
  if (content.m3) return { schema: M3_SCHEMA, build: M3_BUILD }
  return { schema: SCHEMA_VERSION, build: content.m2 ? SIM_BUILD : LEGACY_SIM_BUILD }
}

export function isM3(world: World): world is M3World {
  return world.schema === M3_SCHEMA && world.build === M3_BUILD && world.content.m3 !== undefined
}

/** Read shared graph, gear and recipe tables through the M2 calculation interfaces. */
export function sharedBuildView(world: World): World {
  return world.content.m3 ? { ...world, content: { ...world.content, m2: world.content.m3 } } : world
}

/** Commit shared-rule writes while keeping the canonical content profile on the owning world. */
export function withSharedBuildRules<T>(world: M3World, apply: (view: World) => T): T {
  const view = sharedBuildView(world)
  const result = apply(view)
  Object.assign(world, view, { content: world.content })
  return result
}
