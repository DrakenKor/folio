import type { ActionPreview, EntityId, Operation, OperationResult, QueryResult, SimEvent, StatInspection, World } from '../core/types'

/** T2.2 owns action loadout/fold edits and their atomic recipe validation. */
export function applyCombatOperation(_world: World, _operation: Operation): OperationResult {
  return { accepted: false, reason: 'unsupported' }
}

/** Run after timer/death-age advancement, before AI/actions; T2.2 supplies pulses and expiry. */
export function processAilments(_world: World, _events: SimEvent[]): QueryResult<null> {
  return { ok: false, reason: 'unsupported' }
}

/** T2.2 supplies detached stat sources; this hook never consumes RNG. */
export function inspectStats(_world: World, _actorId: EntityId): QueryResult<StatInspection> {
  return { ok: false, reason: 'unsupported' }
}

/** T2.2 supplies the recipe and damage stages used by contacts. */
export function previewAction(_world: World, _actorId: EntityId, _skillId: string, _targetId: EntityId): QueryResult<ActionPreview> {
  return { ok: false, reason: 'unsupported' }
}
