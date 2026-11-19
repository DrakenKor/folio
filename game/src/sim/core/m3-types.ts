import type {
  M2ActionDefinition, ActionPreview, AilmentState, BuildPreview, CharacterData, CombatContent, EntityId,
  M2FoldDefinition, GroundDrop, M2ItemBase, Loadout, M2Content, OperationReason, ResolvedAction,
  SaveEnvelope, Vec2, World
} from './types'

export const M3_SCHEMA = 5
export const M3_BUILD = 'm3-sim-v1'
export const M3_VERSION = 'm3-v1'
export const M3_SAVE_SCHEMA = 2
export const WEAPON_FAMILIES = ['hemblade', 'plumbshoe', 'verge-reel', 'hearth-frame'] as const
export type WeaponFamily = typeof WEAPON_FAMILIES[number]
export type RequiredItem = WeaponFamily | 'survey-tally'
export const TRAITS = ['double-scored', 'long-heeled'] as const
export type TraitId = typeof TRAITS[number]

export type ActionMechanic =
  | { kind: 'span-cut'; maxSeams: number; refreshTicks: number }
  | { kind: 'open-hem'; seamCost: number; stepTicks: number; halfWidth: number }
  | { kind: 'plinth-blow'; chargedAt: number; autoReleaseAt: number; chargedCoefficient: number; rootTicks: number }
  | { kind: 'brace-mark'; incomingFactor: number; answerReach: number; answerRadius: number }
  | { kind: 'cast-loop'; eyeLifetime: number }
  | { kind: 'gather-line'; stitchFactor: number; stitchReach: number }
  | { kind: 'lay-bed'; radius: number; armTicks: number; expiryTicks: number }
  | { kind: 'lift-print'; halfWidth: number; impressionHeat: number; impressionRadius: number }
  | { kind: 'fold-dart' }
  | { kind: 'rill-fan'; halfWidth: number; pulseTicks: number; maxPulses: number; maxTurnDegrees: number }

export type FoldMechanic =
  | { kind: 'splay'; angles: number[]; primaryFactor: number }
  | { kind: 'through'; maxContacts: number; primaryFactor: number }
  | { kind: 'after'; delayTicks: number; primaryFactor: number; echoFactor: number }
  | { kind: 'hinge'; retraceFraction: number; primaryFactor: number; returnFactor: number }
  | { kind: 'rim'; offset: number; tileRadius: number; laneHalfWidth: number; primaryFactor: number }
  | { kind: 'catch'; delayTicks: number; radius: number; expiryTicks: number; primaryFactor: number; entrantFactor: number }

export type M3ActionDefinition = M2ActionDefinition & { mechanic: ActionMechanic; familyId: RequiredItem; effectIds?: string[] }
export type M3FoldDefinition = M2FoldDefinition & { mechanic: FoldMechanic; whitelist: string[]; effectIds?: string[] }
export type M3ItemBase = M2ItemBase & ({ role: 'weapon'; familyId: WeaponFamily } | { role: Exclude<M2ItemBase['role'], 'weapon'> })

export interface Footprint {
  kind: 'sector' | 'lane' | 'disc'
  origin: Vec2
  direction: number
  reach: number
  halfWidth: number
  radius: number
  arcRadians: number
}
export const EFFECT_KINDS = ['eye', 'tile', 'counter', 'warning', 'echo', 'mark', 'stitch', 'impression'] as const
export interface EffectCard {
  id: string
  kind: typeof EFFECT_KINDS[number]
  footprint: Footprint
  delayTicks: number
  lifetimeTicks: number
  damageFactor: number
  children: string[]
}
export interface WarningCard { footprint: Footprint; delayTicks: number; recoveryTicks: number; effectId?: string }
export interface Warning { id: number; sourceId: EntityId; startTick: number; dueTick: number; footprint: Footprint }
export type ZoneId = string
export type InteractableId = string
export interface Interactable {
  id: InteractableId
  kind: 'objective' | 'waypoint' | 'exit'
  pos: Vec2
  guardSocketIds?: string[]
  arrivalId?: InteractableId
  destination?: ZoneId
}
export interface ZoneDefinition {
  id: ZoneId
  version: number
  /** Row-major floor mask. Each cell is one metre. */
  width: number
  height: number
  walkable: boolean[]
  interactables: Interactable[]
  sockets: Array<{ id: string; enemyId: string; pos: Vec2 }>
}
export interface M3Content extends M2Content {
  version: typeof M3_VERSION
  actions: M3ActionDefinition[]
  folds: M3FoldDefinition[]
  itemBases: M3ItemBase[]
  zones?: ZoneDefinition[]
  effects?: EffectCard[]
  repairOrder?: InteractableId[]
}

export interface ActorMechanics {
  held: { kind: 'charge' | 'channel'; skillId: string; button: number; eligibleTicks: number; releasePending: boolean } | null
  rearmButtons: number
  counter: { value: number; expiresTick: number } | null
  rootedUntil: number
}
export interface OwnedEffect {
  id: EntityId
  ownerId: EntityId
  kind: typeof EFFECT_KINDS[number]
  startTick: number
  dueTick: number
  expiresTick: number
  recipe: ResolvedAction
  footprint: Footprint
  endpoint: Vec2 | null
  groupId: string
  leg: number
  childOrdinal: number
  /** Historical contact ids survive despawn until the leg ends. */
  acceptedTargetIds: EntityId[]
  excludedTargetIds: EntityId[]
}
export interface ZoneInspection {
  zoneId: ZoneId
  version: number
  cells: ZoneDefinition['walkable']
  width: number
  height: number
  interactables: Interactable[]
  nextObjective: InteractableId | null
  warnings: Warning[]
}
export interface CampaignProgress {
  generatorVersion: number
  lastSafeMarker: InteractableId
  stage: 'unstarted' | 'accepted' | 'released' | 'complete'
  repairs: InteractableId[]
  waypoints: InteractableId[]
  creditedSockets: string[]
  uncollectedDrops: Array<GroundDrop & { zoneId: ZoneId; socketId: string }>
}
export type ValidatedContent = Omit<CombatContent, 'm3'> & { m3?: M3Content }
export interface M3World extends World {
  schema: typeof M3_SCHEMA
  build: typeof M3_BUILD
  content: Omit<CombatContent, 'm3'> & { m3: M3Content }
  effects: OwnedEffect[]
  zoneId: ZoneId | null
  progress: CampaignProgress
}
export interface M3CharacterData extends CharacterData { contentVersion: typeof M3_VERSION; progress: CampaignProgress }
export type M3SaveEnvelope = M3CharacterData & Pick<SaveEnvelope, 'format' | 'generation' | 'build'> & { schema: typeof M3_SAVE_SCHEMA }
export type MigrateCharacter = (source: CharacterData, destination: M3Content) => { data: M3CharacterData; refunds: string[] }

export interface PreviewPath {
  role: 'primary' | 'secondary'
  shape: Footprint['kind'] | 'path'
  reach: number
  radius: number
  halfWidth: number
  arcRadians: number
  delayTicks: number
}
export interface M3ActionPreview extends ActionPreview {
  requiredItem: RequiredItem
  lockedReason: Extract<OperationReason, 'wrong-family' | 'tally-required'> | null
  paths: PreviewPath[]
  condition: AilmentState['id'] | null
  payoff: { rootTicks: number } | { secondaryDamage: number } | null
  cost: { tension: number; seams: number }
  conditionalDamage: { clean: number[]; prepared: number[] }
}
export interface M3BuildPreview extends BuildPreview {
  loadout: Loadout
  actions: Array<{ skillId: string; before: M3ActionPreview; after: M3ActionPreview }>
}
