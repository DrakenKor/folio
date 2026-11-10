import { SCHEMA_VERSION } from './types'
import type { SnapshotEnvelope, World } from './types'

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
  if (!world || world.schema !== envelope.schema || typeof world.build !== 'string' || world.build !== envelope.build ||
    !Number.isSafeInteger(world.seed) || !Number.isSafeInteger(world.tick) || world.tick < 0 ||
    !Number.isSafeInteger(world.nextId) || world.nextId < 1 || !Array.isArray(world.entities) ||
    !world.rng || typeof world.rng !== 'object' || Array.isArray(world.rng)) throw new TypeError('Invalid snapshot world')
  canonical(envelope)
  let previousId = 0
  for (const entity of world.entities) {
    if (!entity || !Number.isSafeInteger(entity.id) || entity.id <= previousId || entity.id >= world.nextId ||
      typeof entity.kind !== 'string' || !vector(entity.pos) || !vector(entity.vel) ||
      !Number.isFinite(entity.facing) || !Number.isFinite(entity.radius) || entity.radius < 0 ||
      (entity.action !== null && (!entity.action || typeof entity.action.id !== 'string' ||
        !Number.isSafeInteger(entity.action.startTick) || !Number.isSafeInteger(entity.action.durationTicks) ||
        entity.action.startTick < 0 || entity.action.durationTicks < 0))) throw new TypeError('Invalid snapshot entity')
    previousId = entity.id
  }
  if (world.playerId !== null && !world.entities.some(entity => entity.id === world.playerId && entity.kind === 'player')) throw new TypeError('Invalid snapshot player')
  for (const state of Object.values(world.rng)) {
    if (!Array.isArray(state) || state.length !== 4 || state.some(word => !Number.isInteger(word) || word < 0 || word > 0xffffffff) ||
      state.every(word => word === 0)) throw new TypeError('Invalid snapshot RNG stream')
  }
  return world
}

function vector(value: unknown): boolean {
  const point = value as { x?: number; z?: number } | null
  return !!point && Number.isFinite(point.x) && Number.isFinite(point.z)
}
