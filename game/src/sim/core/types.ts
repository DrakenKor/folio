// Shared simulation types. Owned by the orchestrator: workers code against
// these and propose changes rather than editing them.

/** Fixed simulation rate. */
export const TICK_HZ = 60
export const TICK_DT = 1 / TICK_HZ

/** Bumped whenever the shape of `World` changes. */
export const SCHEMA_VERSION = 2
export const SIM_BUILD = 'm1-sim-v3'

/** Fixed clip measurements at 1.8 m height; see game/ASSETS.md. */
export const GAIT = Object.freeze({ walkSpeed: 0.561, runSpeed: 2.521, walkStride: 0.599, runStride: 2.017 })
export const BODY_TURN_PER_TICK = 0.2617993877991494

export type EntityId = number

/** A point or direction on the ground plane. Height comes from the terrain. */
export interface Vec2 {
  x: number
  z: number
}

/** xoshiro128** state: four unsigned 32-bit integers. */
export type RngState = [number, number, number, number]

export interface ActionTiming {
  windupTicks: number
  activeTicks: number
  recoveryTicks: number
  /** Recovery ages before movement may cancel, in [0, recoveryTicks]. */
  moveCancelTicks: number
}

export type ActionPhase = 'windup' | 'active' | 'recovery' | 'complete'

export interface KnockbackSpec {
  speed: number
  ticks: number
}

interface SkillBase {
  id: string
  timing: ActionTiming
  cooldownTicks: number
  damage: number
  knockback: KnockbackSpec
  impactPauseTicks: number
  hitFlashTicks: number
}

/** M1 fixed damage only; no modifiers, supports or presentation assets. */
export type SkillDefinition = SkillBase & (
  | { kind: 'melee'; range: number; arcRadians: number }
  | { kind: 'projectile'; speed: number; radius: number; lifetimeTicks: number }
)

export interface DodgeDefinition {
  timing: ActionTiming
  distance: number
  cooldownTicks: number
  /** Half-open interval of action ages, within the active phase. */
  invulnerableFrom: number
  invulnerableUntil: number
}

export interface EnemyDefinition {
  id: string
  maxHealth: number
  radius: number
  /** Ordinary locomotion speed in metres/second. */
  moveSpeed: number
  acquireRange: number
  attackRange: number
  skillId: string
  deathTicks: number
}

/** Scenario-owned, immutable after construction, included in snapshots and hashes. */
export interface CombatContent {
  /** Sorted by id; `dodge` is reserved for the built-in action. */
  skills: SkillDefinition[]
  enemies: EnemyDefinition[]
  dodge: DodgeDefinition
}

/** Age is the last processed action age, including zero on the starting tick. */
export interface ActionState {
  id: string
  kind: SkillDefinition['kind'] | 'dodge'
  startTick: number
  ageTicks: number
  /** Locked aim angle, or movement/facing angle for dodge. */
  direction: number
  /** Sorted unique target ids, retained even after a target despawns. */
  hitTargetIds: EntityId[]
  projectileSpawned: boolean
}

export interface GaitState {
  /** Unwrapped cycles; advances only for resolved ordinary locomotion. */
  phase: number
  /** Resolved ordinary locomotion speed, excluding external displacement. */
  speed: number
}

export interface DeathState {
  startTick: number
  ageTicks: number
  /** Enemy definition's deathTicks via ai.enemyId; null without AI holds the terminal pose. */
  despawnAfterTicks: number | null
}

export interface AIState {
  enemyId: string
  phase: 'idle' | 'acquire' | 'chase' | 'telegraph' | 'strike' | 'recover' | 'die'
  ageTicks: number
  targetId: EntityId | null
}

/** Separate from actors: projectiles never participate in circle separation. */
export interface Projectile {
  id: EntityId
  ownerId: EntityId
  faction: string
  skillId: string
  actionStartTick: number
  pos: Vec2
  vel: Vec2
  radius: number
  ageTicks: number
  lifetimeTicks: number
  damage: number
  knockback: KnockbackSpec
  impactPauseTicks: number
  hitFlashTicks: number
}

export interface Entity {
  id: EntityId
  /** Content id, for example `player` or `dummy`. */
  kind: string
  pos: Vec2
  vel: Vec2
  /** Radians, measured from +x towards +z. */
  facing: number
  /** Latest nonzero aim direction in radians, independent of body facing. */
  aim: number
  radius: number
  faction: string
  health: number
  maxHealth: number
  death: DeathState | null
  action: ActionState | null
  skills: { primary: string | null; secondary: string | null }
  cooldowns: { primary: number; secondary: number; dodge: number }
  previousButtons: number
  impactPauseTicks: number
  hitFlashTicks: number
  knockback: { vel: Vec2; remainingTicks: number } | null
  gait: GaitState
  ai: AIState | null
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
  /** Sorted by id, sharing the actors' nextId allocator. */
  projectiles: Projectile[]
  content: CombatContent
  /** Inclusive circular actor-centre bound; null leaves the world unbounded. */
  arena: { center: Vec2; radius: number } | null
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

export const BUTTON_MASK = 0xff

/** The player's input for one tick. */
export interface Command {
  /** Desired movement direction; full length uses GAIT.runSpeed for the player. */
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
  | (ImpactEvent & { type: 'hit'; skillId: string; actionStartTick: number; projectileId: EntityId | null })
  | (ImpactEvent & { type: 'damage'; skillId: string; amount: number; health: number })
  | (ImpactEvent & { type: 'death' })
  | { type: 'dodge'; tick: number; actorId: EntityId; targetId: null; position: Vec2 }

interface ImpactEvent {
  tick: number
  actorId: EntityId
  targetId: EntityId
  position: Vec2
}

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
