/** Explicit failure for an M2 boundary awaiting its owning task. */
export class UnsupportedError extends Error {
  readonly reason = 'unsupported'
  constructor(feature: string) { super(`Unsupported: ${feature}`); this.name = 'UnsupportedError' }
}
