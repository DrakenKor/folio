import { SaveError } from './envelope'

export const WRITER_LOCK = 'folio.arpg.writer'
export const COMMIT_LOCK = 'folio.arpg.commit'

/** The callback promise keeps the writer lock alive between short storage transactions. */
export class Writer {
  private lease?: { release: () => void }
  private disposed = false

  constructor(private locks: LockManager, private onLoss: () => void) {}

  get ownsLock(): boolean { return !!this.lease }

  async acquire(steal: boolean): Promise<boolean> {
    if (this.disposed) throw new SaveError('lost-writer')
    if (this.lease) return true
    let release!: () => void
    const lifetime = new Promise<void>(resolve => { release = resolve })
    const lease = { release }
    return new Promise<boolean>((resolve, reject) => {
      this.locks.request(WRITER_LOCK, steal ? { steal: true } : { ifAvailable: true }, lock => {
        if (this.disposed) { reject(new SaveError('lost-writer')); return }
        if (!lock) { resolve(false); return }
        this.lease = lease
        resolve(true)
        return lifetime
      }).catch(error => {
        if (this.lease === lease) this.revoke()
        reject(error)
      })
    })
  }

  async transaction<T>(run: () => Promise<T> | T): Promise<T> {
    const lease = this.lease
    if (!lease) throw new SaveError('lost-writer')
    return this.locks.request(COMMIT_LOCK, async () => {
      const { held } = await this.locks.query()
      const client = held?.find(lock => lock.name === COMMIT_LOCK)?.clientId
      if (this.lease !== lease || !client || !held?.some(lock => lock.name === WRITER_LOCK && lock.clientId === client)) {
        if (this.lease === lease) this.revoke()
        throw new SaveError('lost-writer')
      }
      return run()
    })
  }

  revoke(): void {
    this.lease?.release()
    this.lease = undefined
    this.onLoss()
  }

  dispose(): void {
    this.disposed = true
    this.revoke()
  }
}
