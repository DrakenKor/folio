// Shared simulation types. Owned by the orchestrator: workers code against
// these and propose changes rather than editing them.

/** Fixed simulation rate. */
export const TICK_HZ = 60
export const TICK_DT = 1 / TICK_HZ

/** Bumped whenever the shape of `World` changes. */
export const SCHEMA_VERSION = 1

export type EntityId = number

/** A point or direction on the ground plane. Height comes from the terrain. */
export interface Vec2 {
  x: number
  z: number
}

/** xoshiro128** state: four unsigned 32-bit integers. */
export type RngState = [number, number, number, number]

/** What an entity is doing, so presentation can derive animation time from ticks. */
export interface ActionState {
  id: string
  startTick: number
  durationTicks: number
}

export interface Entity {
  id: EntityId
  /** Content id, for example `player` or `dummy`. */
  kind: string
  pos: Vec2
  vel: Vec2
  /** Radians, measured from +x towards +z. */
  facing: number
  radius: number
  action: ActionState | null
}

/** The whole simulation state. Plain data: it serialises to canonical JSON. */
export interface World {
  schema: number
  build: string
  seed: number
  tick: number
  nextId: EntityId
  /** One RNG stream per subsystem, keyed by subsystem name. */
  rng: Record<string, RngState>
  /** Always sorted by ascending id, so iteration order is deterministic. */
  entities: Entity[]
  playerId: EntityId | null
}

export const Button = {
  Primary: 1 << 0,
  Secondary: 1 << 1,
  Dodge: 1 << 2,
  Skill1: 1 << 3,
  Skill2: 1 << 4,
  Skill3: 1 << 5,
  Skill4: 1 << 6,
  Interact: 1 << 7
} as const

/** The player's input for one tick. */
export interface Command {
  /** Desired movement direction, length at most 1. */
  move: Vec2
  /** Aim point in world space, or null when there is no pointer. */
  aim: Vec2 | null
  /** Bitmask of `Button` values held this tick. */
  buttons: number
}

export const IDLE_COMMAND: Readonly<Command> = Object.freeze({
  move: Object.freeze({ x: 0, z: 0 }),
  aim: null,
  buttons: 0
})

/** Emitted during a tick for render, UI and audio. Never read back by the sim. */
export type SimEvent =
  | { type: 'spawn'; tick: number; id: EntityId; kind: string }
  | { type: 'despawn'; tick: number; id: EntityId }
  | { type: 'action'; tick: number; id: EntityId; action: string }

export interface SnapshotEnvelope {
  format: 'folio.arpg.snapshot'
  schema: number
  build: string
  world: World
}

export interface Replay {
  format: 'folio.arpg.replay'
  start: SnapshotEnvelope
  /** One command per tick, starting at `start.world.tick`. */
  commands: Command[]
  /** `[tick, hash]` pairs, every 60 ticks. */
  hashes: Array<[number, string]>
}
