// Shared simulation types. Owned by the orchestrator: workers code against
// these and propose changes rather than editing them.

/** Fixed simulation rate. */
export const TICK_HZ = 60
export const TICK_DT = 1 / TICK_HZ

/** Bumped whenever the shape of `World` changes. */
export const SCHEMA_VERSION = 4
export const SIM_BUILD = 'm2-sim-v1'

export const SCENARIO_NAMES = ['empty', 'meadow-start', 'dummies-1000', 'm1-arena', 'm1-fight', 'm1-stress'] as const
export const M2_SCENARIO_NAMES = ['m2-clearing', 'm2-balance', 'm2-stress'] as const
export type ScenarioName = typeof SCENARIO_NAMES[number] | typeof M2_SCENARIO_NAMES[number]

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
  /** Absent for legacy M1 fixed-damage fixtures. */
  m2?: M2Content
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
  recipe?: ResolvedAction
  groupId?: string
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
  recipe?: ResolvedAction
  groupId?: string
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
  /** Null on M0/M1 actors; all rolled items and build choices are continuation data. */
  character: CharacterState | null
  /** Remaining cooldown by action identity, independent of loadout position. */
  skillCooldowns: Record<string, number>
}

/** The whole simulation state. Plain data: it serialises to canonical JSON. */
export interface World {
  schema: number
  build: string
  /** Persisted encounter identity; selects scenario-specific continuation such as fight waves. */
  scenario: ScenarioName
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
  nextItemId: number
  encounter: EncounterState | null
  groundDrops: GroundDrop[]
  ailments: AilmentState[]
  actionGroups: ActionGroup[]
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
  /** Atomic edits applied in array order before actor processing; omission means empty. */
  operations?: Operation[]
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
  | OperationEvent

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

export const DAMAGE_TYPES = ['weight', 'heat', 'gale'] as const
export type DamageType = typeof DAMAGE_TYPES[number]
export type DamageValues = Record<DamageType, number>
export const ACTION_TAGS = ['weapon', 'melee', 'area', 'cast', 'projectile'] as const
export type ActionTag = typeof ACTION_TAGS[number]
export const EQUIPMENT_ROLES = ['weapon', 'offhand', 'coat', 'boots', 'survey-tally'] as const
export type EquipmentRole = typeof EQUIPMENT_ROLES[number]
export type ItemId = number
export type ItemStore = 'inventory' | 'stash'
export type Loadout = [string | null, string | null, string | null, string | null, string | null, string | null]

/** Stable instance ids determine arithmetic order; filters use AND tags and OR final types. */
export type StatModifier = { id: string; requiredTags: ActionTag[]; types: DamageType[] } & (
  | { kind: 'flat'; damageType: DamageType; value: number }
  | { kind: 'boost' | 'multiplier'; value: number }
  | { kind: 'conversion'; from: DamageType; to: DamageType; value: number }
  | { kind: 'health' | 'healthMultiplier' | 'movement' | 'reach' | 'reachMultiplier' | 'recovery' | 'dodgeRecovery' | 'dodgeCooldown'; value: number }
  | { kind: 'reduction'; damageType: DamageType; value: number }
)

/** M2 sectors retain the melee collision kind; delivery is determined only by tags. */
export type ActionDefinition = SkillDefinition & {
  name: string
  tags: ActionTag[]
  baseDamage: DamageValues
  weaponCoefficient: number
  /** Nominal reach, also used to recompute projectile lifetime. */
  reach: number
}

export interface FoldDefinition {
  id: string
  name: string
  handle: 'reach' | 'spread' | 'material'
  tension: 1 | 2
  compatibility: 'finite-reach' | 'single-projectile' | 'melee-sector' | 'sector' | 'positive-weight' | 'positive-heat' | 'any'
  modifiers: StatModifier[]
  reachFactor: number
  arcFactor: number
  radiusFactor: number
  windupDelta: number
  recoveryDelta: number
  /** Degrees relative to locked aim; a single dart uses [0]. */
  projectileAngles: number[]
}

export interface GraphFamily { id: string; name: string; modifiers: StatModifier[] }
export interface ShapeBargain {
  orientation: number
  rhombus: StatModifier[]
  hexagon: StatModifier[]
}
export interface GraphProfile {
  id: string
  version: number
  radius: number
  families: GraphFamily[]
  bargains: ShapeBargain[]
}

export interface ItemBase {
  id: string
  name: string
  role: EquipmentRole
  /** One default per role, used when saved content disappears. */
  starter: boolean
  weaponDamage: DamageValues
  modifiers: StatModifier[]
}
export interface AffixTier { tier: 1 | 2 | 3; min: number; max: number; unlockRank: number }
export interface AffixDefinition {
  id: string
  name: string
  category: 'offensive' | 'utility'
  roles: EquipmentRole[]
  /** Integer roll multiplied by valuePerPoint supplies modifier.value. */
  modifier: StatModifier
  valuePerPoint: number
  tiers: AffixTier[]
}
export interface LootTable {
  id: string
  dropChance: number
  roles: Array<{ role: EquipmentRole; weight: number }>
  rarities: Array<{ categories: AffixDefinition['category'][]; weight: number }>
  tiers: Array<{ tier: 1 | 2 | 3; weight: number; unlockRank: number }>
}
export interface M2Content {
  version: string
  actions: ActionDefinition[]
  folds: FoldDefinition[]
  graphProfiles: GraphProfile[]
  itemBases: ItemBase[]
  affixes: AffixDefinition[]
  lootTables: LootTable[]
}

export interface RolledAffix { familyId: string; category: AffixDefinition['category']; tier: 1 | 2 | 3; roll: number }
export interface RolledItem { id: ItemId; baseId: string; role: EquipmentRole; affixes: RolledAffix[] }
export interface CharacterState {
  rank: number
  xp: number
  points: number
  graph: { profileId: string; seed: number; version: number; allocations: string[]; activeShapes: string[] }
  items: RolledItem[]
  equipment: Record<EquipmentRole, ItemId | null>
  inventory: ItemId[]
  stash: ItemId[]
  loadout: Loadout
  folds: Record<string, string[]>
}
export interface GroundDrop { item: RolledItem; pos: Vec2 }
export interface EncounterState {
  id: string
  phase: 'rest' | 'active' | 'defeat'
  attempt: number
  /** Reward claims survive corpse despawn and prevent duplicate death credit. */
  rewardedIds: EntityId[]
}
export type AilmentState = {
  targetId: EntityId
  sourceId: EntityId
  appliedTick: number
  expiresTick: number
} & (
  | { id: 'burden' | 'draftbind'; nextPulseTick: null }
  | { id: 'emberprint'; nextPulseTick: number }
)
export interface ActionGroup { id: string; actorId: EntityId; actionStartTick: number; hitTargetIds: EntityId[] }
export interface ResolvedAction {
  skillId: string
  tags: ActionTag[]
  folds: string[]
  sourceDamage: DamageValues
  modifiers: StatModifier[]
  timing: ActionTiming
  footprint: { kind: SkillDefinition['kind']; reach: number; arcRadians: number; radius: number; speed: number; lifetimeTicks: number; projectileAngles: number[] }
}

export type Operation =
  | { type: 'allocate' | 'refund'; nodeId: string }
  | { type: 'activateShape'; shapeId: string; active: boolean }
  | { type: 'equip'; itemId: ItemId }
  | { type: 'unequip'; role: EquipmentRole }
  | { type: 'setLoadout'; slots: Loadout }
  | { type: 'setFolds'; skillId: string; foldIds: string[] }
  | { type: 'pickup'; itemId: ItemId }
  | { type: 'stash'; itemId: ItemId; from: ItemStore }
  | { type: 'discard'; itemId: ItemId; from: ItemStore }
  | { type: 'beginEncounter' | 'returnToShelter' }

export const OPERATION_REASONS = [
  'unsupported', 'no-player', 'dead', 'requires-rest', 'unknown-node', 'already-allocated', 'not-connected',
  'insufficient-points', 'unknown-shape', 'incomplete-shape', 'shape-limit', 'shape-overlap', 'unknown-item',
  'wrong-role', 'weapon-required', 'inventory-full', 'stash-full', 'unknown-skill', 'duplicate-skill',
  'unknown-fold', 'incompatible-fold', 'duplicate-handle', 'tension-limit', 'invalid-recipe', 'out-of-range',
  'encounter-active', 'encounter-inactive'
] as const
export type OperationReason = typeof OPERATION_REASONS[number]
export type OperationResult = { accepted: true; reason: 'ok' } | { accepted: false; reason: OperationReason }
export type OperationEvent = { tick: number; index: number; operation: Operation } & (
  | { type: 'operationAccepted'; reason: 'ok' }
  | { type: 'operationRejected'; reason: OperationReason }
)

export type QueryReason = 'unsupported' | 'no-actor' | 'unknown-skill' | 'unknown-target' | OperationReason
export type QueryResult<T> = { ok: true; value: T } | { ok: false; reason: QueryReason }
export interface StatInspection {
  actorId: EntityId
  sources: Array<{ id: string; label: string; modifiers: StatModifier[] }>
  maxHealth: number
  movementSpeed: number
  reductions: DamageValues
  dodge: DodgeDefinition
}
export interface DamagePreview {
  baseAndFlat: DamageValues
  conversions: Array<{ from: DamageType; to: DamageType; requested: number; effective: number }>
  converted: DamageValues
  boosts: DamageValues
  multipliers: DamageValues
  reductions: DamageValues
  postDefence: DamageValues
  calculated: number
  applied: number
}
export interface AilmentRule {
  id: AilmentState['id']
  damageType: DamageType
  threshold: number
  durationTicks: number
  pulseTicks: number | null
  pulseBase: number | null
}
export interface ActionPreview {
  recipe: ResolvedAction
  stats: StatInspection
  damage: DamagePreview
  ailments: AilmentRule[]
}
export interface BuildPreview {
  operation: Operation
  result: OperationResult
  before: StatInspection
  after: StatInspection
  delta: { maxHealth: number; movementSpeed: number; reductions: DamageValues; points: number }
  refundedNodeIds: string[]
  deactivatedShapeIds: string[]
  actions: Array<{ skillId: string; before: ActionPreview; after: ActionPreview }>
}

/** Pure character projection; generation and application build belong to the save envelope. */
export interface CharacterData {
  contentVersion: string
  seed: number
  character: CharacterState
  lootRng: RngState
  nextItemId: number
  questFlags: Record<string, never>
  settings: Record<string, never>
}
export interface CharacterLoad { world: World; refunds: string[] }
export const SAVE_FORMAT = 'folio.arpg.save'
export const SAVE_SCHEMA = 1
export const SAVE_MAX_BYTES = 1024 * 1024
export interface SaveEnvelope extends CharacterData {
  format: typeof SAVE_FORMAT
  schema: typeof SAVE_SCHEMA
  generation: number
  build: string
}
/** Fixture-only input for the platform migration; never a debug snapshot. */
export type LegacySaveEnvelope = Omit<SaveEnvelope, 'schema' | 'contentVersion' | 'lootRng' | 'nextItemId'> & { schema: 0 }
export type SaveStatusCode = 'unsupported' | 'ready' | 'read-only' | 'blocked' | 'lost-writer' | 'generation-mismatch' |
  'corrupt' | 'future-schema' | 'invalid-character' | 'oversize' | 'quota' | 'security' | 'read-failed'
export interface SaveStatus {
  code: SaveStatusCode
  writable: boolean
  generation: number
  text: string | null
  refunds: string[]
}
export type SaveResult = { ok: true; status: SaveStatus } | { ok: false; reason: SaveStatusCode; status: SaveStatus }
