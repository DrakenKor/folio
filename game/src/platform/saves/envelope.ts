import { rngFloat } from '../../sim/core/rng'
import { canonical } from '../../sim/core/snapshot'
import { createWorld } from '../../sim/core/store'
import { SAVE_FORMAT, SAVE_MAX_BYTES, SAVE_SCHEMA } from '../../sim/core/types'
import type { CharacterData, CombatContent, LegacySaveEnvelope, SaveEnvelope, SaveStatusCode } from '../../sim/core/types'

export class SaveError extends Error {
  constructor(readonly code: SaveStatusCode, readonly text?: string) { super(code) }
}

export function checkSaveSize(text: string, copyOnFailure = false): void {
  if (text.length * 2 > SAVE_MAX_BYTES || new TextEncoder().encode(text).byteLength > SAVE_MAX_BYTES) {
    throw new SaveError('oversize', copyOnFailure ? text : undefined)
  }
}

export function encodeSave(data: CharacterData, build: string, generation: number): string {
  if (!Number.isSafeInteger(generation) || generation < 0) throw new SaveError('corrupt')
  const envelope: SaveEnvelope = { ...data, format: SAVE_FORMAT, schema: SAVE_SCHEMA, build, generation }
  const text = canonical(envelope)
  checkSaveSize(text, true)
  return text
}

export function parseEnvelope(text: string): SaveEnvelope | LegacySaveEnvelope {
  checkSaveSize(text)
  let save
  try { save = JSON.parse(text) } catch { throw new SaveError('corrupt') }
  if (save?.format !== SAVE_FORMAT || !Number.isSafeInteger(save.schema)) throw new SaveError('corrupt')
  if (save.schema > SAVE_SCHEMA) throw new SaveError('future-schema')
  if (save.schema < 0 || typeof save.build !== 'string' || !Number.isSafeInteger(save.generation) || save.generation < 0) {
    throw new SaveError('corrupt')
  }
  return save
}

export function characterData(save: SaveEnvelope | LegacySaveEnvelope, content: CombatContent): CharacterData {
  const { seed, character, questFlags, settings } = save
  if (!Number.isSafeInteger(seed) || !character || !Array.isArray(character.items) ||
      ![questFlags, settings].every(field => field && Object.getPrototypeOf(field) === Object.prototype && !Object.keys(field).length)) {
    throw new SaveError('invalid-character')
  }
  if (save.schema === 0) {
    if (!content.m2) throw new SaveError('invalid-character')
    const world = createWorld(seed)
    rngFloat(world, 'loot')
    const nextItemId = character.items.reduce((next, item) => Math.max(next, item.id + 1), 1)
    return { character, seed, questFlags, settings, contentVersion: content.m2.version, lootRng: world.rng.loot!, nextItemId }
  }
  const { contentVersion, lootRng, nextItemId } = save
  if (typeof contentVersion !== 'string' || !contentVersion || !Number.isSafeInteger(nextItemId) || nextItemId < 1 ||
      !Array.isArray(lootRng) || lootRng.length !== 4 || !lootRng.every(n => Number.isInteger(n) && n >= 0 && n <= 0xffffffff) ||
      lootRng.every(n => n === 0)) throw new SaveError('invalid-character')
  return { character, seed, questFlags, settings, contentVersion, lootRng, nextItemId }
}
