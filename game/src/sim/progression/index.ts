import { validateOperation } from '../core/commands'
import type { BuildPreview, CharacterData, CharacterLoad, CombatContent, Operation, OperationResult, QueryResult, SimEvent, World } from '../core/types'
import { UnsupportedError } from '../core/unsupported'

/** T2.3 owns graph, items and encounter operations. */
export function applyProgressionOperation(_world: World, _operation: Operation): OperationResult {
  return { accepted: false, reason: 'unsupported' }
}

/** Run after contact deaths, before scheduled encounter transitions. */
export function processProgression(_world: World, _events: SimEvent[]): QueryResult<null> {
  return { ok: false, reason: 'unsupported' }
}

/** T2.3 coordinates detached build edits with T2.2 combat previews. */
export function previewBuild(_world: World, edit: Operation): QueryResult<BuildPreview> {
  validateOperation(edit)
  return { ok: false, reason: 'unsupported' }
}

/** Project one character without combat transients or platform generation. */
export function exportCharacter(_world: World): CharacterData {
  throw new UnsupportedError('exportCharacter (T2.3)')
}

/** Validate a projection and construct a fresh rested clearing, returning content refunds. */
export function loadCharacter(_data: unknown, _content: CombatContent): CharacterLoad {
  throw new UnsupportedError('loadCharacter (T2.3)')
}
