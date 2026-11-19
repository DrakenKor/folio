import { m2Content } from '../../content/m2'
import { rngFloat } from '../../sim/core/rng'
import { canonical } from '../../sim/core/snapshot'
import { createWorld } from '../../sim/core/store'
import { M3_SAVE_SCHEMA, M3_VERSION, SAVE_FORMAT, SAVE_MAX_BYTES, SAVE_SCHEMA } from '../../sim/core/types'
import type { CharacterData, CombatContent, LegacySaveEnvelope, M3CharacterData, M3SaveEnvelope, SaveEnvelope, SaveStatusCode } from '../../sim/core/types'

export type PlayerEnvelope = LegacySaveEnvelope | SaveEnvelope | M3SaveEnvelope

export class SaveError extends Error {
  constructor(readonly code: SaveStatusCode, readonly text?: string) { super(code) }
}

export function checkSaveSize(text: string, copyOnFailure = false): void {
  if (text.length * 2 > SAVE_MAX_BYTES || new TextEncoder().encode(text).byteLength > SAVE_MAX_BYTES) {
    throw new SaveError('oversize', copyOnFailure ? text : undefined)
  }
}

export function encodeSave(data: CharacterData, build: string, generation: number,
  schema = 'progress' in data ? M3_SAVE_SCHEMA : SAVE_SCHEMA): string {
  if (!Number.isSafeInteger(generation) || generation < 0) throw new SaveError('corrupt')
  if (schema === M3_SAVE_SCHEMA && (data.contentVersion !== M3_VERSION || !('progress' in data)) ||
      schema === SAVE_SCHEMA && ('progress' in data || data.contentVersion === M3_VERSION)) throw new SaveError('invalid-character')
  const envelope = { ...data, format: SAVE_FORMAT, schema, build, generation }
  const text = canonical(envelope)
  checkSaveSize(text, true)
  return text
}

export function parseEnvelope(text: string, maxSchema: number = M3_SAVE_SCHEMA): PlayerEnvelope {
  checkSaveSize(text)
  let save
  try { save = JSON.parse(text) } catch { throw new SaveError('corrupt') }
  if (save?.format !== SAVE_FORMAT || !Number.isSafeInteger(save.schema)) throw new SaveError('corrupt')
  if (save.schema > maxSchema) throw new SaveError('future-schema')
  if (save.schema < 0 || typeof save.build !== 'string' || !Number.isSafeInteger(save.generation) || save.generation < 0) {
    throw new SaveError('corrupt')
  }
  return save
}

export function characterData(save: PlayerEnvelope, content: CombatContent): CharacterData {
  const { seed, character, questFlags, settings } = save
  if (!Number.isSafeInteger(seed) || !character || !Array.isArray(character.items) ||
      ![questFlags, settings].every(field => field && Object.getPrototypeOf(field) === Object.prototype && !Object.keys(field).length)) {
    throw new SaveError('invalid-character')
  }
  if ((save.schema === M3_SAVE_SCHEMA) !== ('progress' in save) ||
      (save.schema === M3_SAVE_SCHEMA && save.contentVersion !== M3_VERSION) ||
      (save.schema === SAVE_SCHEMA && save.contentVersion === M3_VERSION)) throw new SaveError('invalid-character')
  if (save.schema === 0) {
    const legacy = content.m3 ? m2Content() : content
    if (!legacy.m2 || 'contentVersion' in save || 'lootRng' in save || 'nextItemId' in save) throw new SaveError('invalid-character')
    const world = createWorld(seed, undefined, legacy)
    rngFloat(world, 'loot')
    const nextItemId = character.items.reduce((next, item) => Math.max(next, item.id + 1), 1)
    return { character, seed, questFlags, settings, contentVersion: legacy.m2.version, lootRng: world.rng.loot!, nextItemId }
  }
  const { contentVersion, lootRng, nextItemId } = save
  if (typeof contentVersion !== 'string' || !contentVersion || !Number.isSafeInteger(nextItemId) || nextItemId < 1 ||
      !Array.isArray(lootRng) || lootRng.length !== 4 || !lootRng.every(n => Number.isInteger(n) && n >= 0 && n <= 0xffffffff) ||
      lootRng.every(n => n === 0)) throw new SaveError('invalid-character')
  const data = { character, seed, questFlags, settings, contentVersion, lootRng, nextItemId }
  if (save.schema === M3_SAVE_SCHEMA) {
    const current: M3CharacterData = { ...data, contentVersion: save.contentVersion, progress: save.progress }
    return current
  }
  return data
}
