import type { CharacterData, CharacterLoad, CombatContent, SaveResult, SaveStatus, World } from '../../sim/core/types'
import { UnsupportedError } from '../../sim/core/unsupported'

export { SAVE_FORMAT, SAVE_MAX_BYTES, SAVE_SCHEMA } from '../../sim/core/types'
export type { LegacySaveEnvelope, SaveEnvelope, SaveResult, SaveStatus, SaveStatusCode } from '../../sim/core/types'

export const SAVE_KEY = 'folio.arpg.save'
export const WRITER_LOCK = 'folio.arpg.writer'
export const COMMIT_LOCK = 'folio.arpg.commit'

export interface SaveControllerOptions {
  build: string
  content: CombatContent
  getWorld: () => World
  /** The caller releases input and resets recorder/interpolation on replacement. */
  replaceWorld: (world: World) => void
  exportCharacter: (world: World) => CharacterData
  loadCharacter: (data: unknown, content: CombatContent) => CharacterLoad
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
  locks?: LockManager
}

/** T2.5 supplies storage, migrations and generation-checked writer/commit locks. */
export class SaveController {
  constructor(readonly options: SaveControllerOptions) {}
  status(): SaveStatus { return { code: 'unsupported', writable: false, generation: 0, text: null, refunds: [] } }
  export(): string { throw new UnsupportedError('save export (T2.5)') }
  async import(_text: string): Promise<SaveResult> { return this.unsupported() }
  async flush(): Promise<SaveResult> { return this.unsupported() }
  async load(): Promise<SaveResult> { return this.unsupported() }
  async reset(): Promise<SaveResult> { return this.unsupported() }
  async takeOver(): Promise<SaveResult> { return this.unsupported() }
  dispose(): void {}
  private unsupported(): SaveResult { return { ok: false, reason: 'unsupported', status: this.status() } }
}
