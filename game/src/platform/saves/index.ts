import type { CharacterData, CharacterLoad, CombatContent, LegacySaveEnvelope, SaveEnvelope, SaveResult, SaveStatus, SaveStatusCode, World } from '../../sim/core/types'
import { UnsupportedError } from '../../sim/core/unsupported'
import { buildScenario } from '../../sim/scenarios'
import { characterData, checkSaveSize, encodeSave, parseEnvelope, SaveError } from './envelope'
import { refundRemovedContent } from './refunds'
import { Writer } from './writer'

export { SAVE_FORMAT, SAVE_MAX_BYTES, SAVE_SCHEMA } from '../../sim/core/types'
export type { LegacySaveEnvelope, SaveEnvelope, SaveResult, SaveStatus, SaveStatusCode } from '../../sim/core/types'
export { COMMIT_LOCK, WRITER_LOCK } from './writer'
export const SAVE_KEY = 'folio.arpg.save'

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
  /** Session wiring distinguishes player progression from explicit debug worlds and replays. */
  isPlayerSession?: () => boolean
  createFreshWorld?: () => World
}

function reason(error: unknown): SaveStatusCode {
  if (error instanceof SaveError) return error.code
  if (error instanceof UnsupportedError) return 'unsupported'
  if (error instanceof Error && error.name === 'SecurityError') return 'security'
  return 'invalid-character'
}

export class SaveController {
  private state: SaveStatus = { code: 'read-only', writable: false, generation: 0, text: null, refunds: [] }
  private readonly writer?: Writer
  private timer?: number
  private disposed = false
  private queue = Promise.resolve()
  /** Exact bytes also let an explicit reset/import recover a corrupt slot safely. */
  private observed: string | null | undefined
  private unreadableEnvelope = false
  private barrier?: { reached: boolean; wait: Promise<void>; release: () => void }

  constructor(readonly options: SaveControllerOptions) {
    const locks = options.locks ?? globalThis.navigator?.locks
    if (locks) {
      this.state.code = 'blocked'
      this.writer = new Writer(locks, () => this.setCode('lost-writer'))
    }
  }

  status(): SaveStatus { return structuredClone(this.state) }

  export(): string {
    if (this.state.text !== null) {
      checkSaveSize(this.state.text)
      return this.state.text
    }
    return this.encode(this.options.getWorld(), this.state.generation)
  }

  private encode(world: World, generation: number): string {
    return encodeSave(this.options.exportCharacter(world), this.options.build, generation)
  }

  private decode(save: SaveEnvelope | LegacySaveEnvelope): CharacterLoad {
    const data = characterData(save, this.options.content)
    const refunds = this.options.content.m2 ? refundRemovedContent(data, this.options.content.m2) : []
    const loaded = this.options.loadCharacter(data, this.options.content)
    return { world: loaded.world, refunds: [...refunds, ...loaded.refunds] }
  }

  private fresh(): CharacterLoad {
    return { world: this.options.createFreshWorld?.() ?? buildScenario('m2-clearing', this.options.getWorld().seed), refunds: [] }
  }

  private setCode(code: SaveStatusCode): void {
    this.state.code = code
    this.state.writable = code === 'ready'
  }

  private failure(code: SaveStatusCode): SaveResult {
    return { ok: false, reason: code, status: this.status() }
  }

  private run(action: () => Promise<void>): Promise<SaveResult> {
    const result = this.queue.then(async (): Promise<SaveResult> => {
      if (this.disposed) return this.failure('lost-writer')
      try { await action(); return { ok: true, status: this.status() } }
      catch (error) {
        const code = reason(error)
        if (error instanceof SaveError && error.text !== undefined) this.state.text = error.text
        if (this.state.text === null && (code === 'security' || code === 'read-failed')) {
          try { this.state.text = this.encode(this.options.getWorld(), this.state.generation) } catch { /* No exportable character yet. */ }
        }
        this.setCode(code)
        return this.failure(code)
      }
    })
    this.queue = result.then(() => {})
    return result
  }

  private read(): string | null {
    try { return (this.options.storage ?? globalThis.localStorage).getItem(SAVE_KEY) }
    catch (error) { throw new SaveError(reason(error) === 'security' ? 'security' : 'read-failed') }
  }

  private checkObserved(): void {
    const text = this.read()
    // Exact equality also protects unparseable bytes during explicit import/reset.
    if (text !== this.observed || (text !== null && !this.unreadableEnvelope &&
        parseEnvelope(text).generation !== this.state.generation)) {
      this.writer?.revoke()
      throw new SaveError('generation-mismatch')
    }
  }

  private observe(text: string | null): SaveEnvelope | LegacySaveEnvelope | null {
    this.observed = text
    this.state.text = text
    this.state.generation = 0
    this.unreadableEnvelope = text !== null
    const save = text === null ? null : parseEnvelope(text)
    if (save) this.state.generation = save.generation
    this.unreadableEnvelope = false
    return save
  }

  private install(loaded: CharacterLoad): void {
    this.options.replaceWorld(loaded.world)
    this.state.refunds = loaded.refunds
  }

  private async readWorld(code: 'ready' | 'blocked' | 'read-only'): Promise<void> {
    const save = this.observe(this.read())
    if (save) {
      const loaded = this.decode(save)
      if (code === 'ready' && this.options.isPlayerSession?.() !== false && (save.schema === 0 || loaded.refunds.length > 0)) {
        return this.write(loaded)
      }
      this.install(loaded)
    }
    this.state.text = null
    this.setCode(code)
  }

  load(): Promise<SaveResult> {
    return this.run(async () => {
      if (!this.writer) return this.readWorld('read-only')
      this.listen()
      if (!await this.writer.acquire(false)) return this.readWorld('blocked')
      this.setCode('blocked')
      await this.writer.transaction(() => this.readWorld('ready'))
    })
  }

  private listen(): void {
    globalThis.window?.addEventListener('storage', this.onStorage)
    if (globalThis.window && this.options.isPlayerSession && this.timer === undefined) {
      this.timer = window.setInterval(this.autosave, 30_000)
      window.addEventListener('pagehide', this.autosave)
    }
  }

  private autosave = (): void => {
    if (this.state.writable && this.options.isPlayerSession?.()) void this.flush()
  }

  private onStorage = (event: StorageEvent): void => {
    if ((event.key !== null && event.key !== SAVE_KEY) || !this.state.writable) return
    void this.run(async () => {
      if (this.state.writable) await this.writer!.transaction(() => this.checkObserved())
    })
  }

  /** Called only inside a checked commit transaction. */
  private async write(loaded?: CharacterLoad): Promise<void> {
    const generation = this.state.generation + 1
    const text = this.encode(loaded?.world ?? this.options.getWorld(), generation)
    if (import.meta.env.DEV && this.barrier) {
      this.barrier.reached = true
      await this.barrier.wait
    }
    if (this.disposed) throw new SaveError('lost-writer')
    try { (this.options.storage ?? globalThis.localStorage).setItem(SAVE_KEY, text) }
    catch (error) {
      this.state.text = text
      throw new SaveError(reason(error) === 'security' ? 'security' : 'quota')
    }
    this.observed = text
    this.unreadableEnvelope = false
    this.state.generation = generation
    this.state.text = null
    if (loaded) this.install(loaded)
    // A stolen writer may finish this commit while the new tab waits for it.
    if (this.state.code !== 'lost-writer') this.setCode('ready')
  }

  flush(): Promise<SaveResult> {
    if (this.options.isPlayerSession?.() === false) return Promise.resolve(this.failure('read-only'))
    if (!this.state.writable) return Promise.resolve(this.failure(this.state.code))
    return this.run(async () => {
      if (!this.state.writable) throw new SaveError(this.state.code)
      await this.writer!.transaction(() => {
        if (this.options.isPlayerSession?.() === false) throw new SaveError('read-only')
        this.checkObserved()
        return this.write()
      })
    })
  }

  private replace(load: () => CharacterLoad): Promise<SaveResult> {
    return this.run(async () => {
      const loaded = load()
      if (!this.writer) {
        this.encode(loaded.world, this.state.generation)
        this.install(loaded)
        this.state.text = null
        this.setCode('read-only')
        return
      }
      await this.writer.transaction(() => {
        this.checkObserved()
        return this.write(loaded)
      })
    })
  }

  import(text: string): Promise<SaveResult> { return this.replace(() => this.decode(parseEnvelope(text))) }
  reset(): Promise<SaveResult> { return this.replace(() => this.fresh()) }

  takeOver(): Promise<SaveResult> {
    if (!this.writer) return Promise.resolve(this.failure('read-only'))
    return this.run(async () => {
      this.setCode('blocked')
      if (!await this.writer!.acquire(true)) throw new SaveError('blocked')
      this.listen()
      await this.writer!.transaction(() => {
        const save = this.observe(this.read())
        return this.write(save === null ? this.fresh() : this.decode(save))
      })
    })
  }

  commitBarrier(action: 'arm' | 'reached' | 'release'): boolean {
    if (!import.meta.env.DEV) return false
    if (action === 'arm' && !this.barrier) {
      let release!: () => void
      const wait = new Promise<void>(resolve => { release = resolve })
      this.barrier = { wait, release, reached: false }
    }
    if (action === 'release') {
      this.barrier?.release()
      this.barrier = undefined
    }
    return this.barrier?.reached ?? false
  }

  dispose(): void {
    this.disposed = true
    this.commitBarrier('release')
    this.writer?.dispose()
    globalThis.window?.removeEventListener('storage', this.onStorage)
    globalThis.window?.removeEventListener('pagehide', this.autosave)
    globalThis.window?.clearInterval(this.timer)
  }
}
