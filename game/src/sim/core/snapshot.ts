import { LEGACY_SIM_BUILD, SCHEMA_VERSION, SIM_BUILD } from './types'
import type { SnapshotEnvelope, World } from './types'
import { validateWorld } from './validation'

/** Encode plain JSON data with lexically sorted object keys and finite numbers. */
export function canonical(value: unknown): string {
  if (value === null) return 'null'
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Snapshot numbers must be finite')
    return JSON.stringify(value)
  }
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`
  }
  throw new TypeError('Snapshots contain only plain JSON data')
}

/** Serialize all state inside a versioned, canonical envelope. */
export function serialize(world: World): string {
  const envelope: SnapshotEnvelope = { format: 'folio.arpg.snapshot', schema: world.schema, build: world.build, world }
  return canonical(envelope)
}

/** Restore a detached world, rejecting incompatible or malformed snapshots. */
export function restore(text: string): World {
  const envelope: SnapshotEnvelope = JSON.parse(text)
  if (envelope?.format !== 'folio.arpg.snapshot' || envelope.schema !== SCHEMA_VERSION) throw new TypeError('Unsupported snapshot format or schema')
  const world = envelope.world
  const expectedBuild = world?.content?.m2 ? SIM_BUILD : LEGACY_SIM_BUILD
  if (envelope.build !== expectedBuild || world?.build !== envelope.build) throw new TypeError(`Unsupported simulation build; expected ${expectedBuild}`)
  if (world.schema !== envelope.schema) throw new TypeError('Unsupported snapshot world schema')
  canonical(envelope)
  validateWorld(world)
  return world
}
