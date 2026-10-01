// The main-thread client for the benchmark worker, so pages do not hand-roll
// worker plumbing. Kept apart from bench.ts, which the worker itself imports:
// a module that spawns a worker whose graph contains that same module stalls
// the Turbopack production build.

import type { WasmStatus, WorkloadResult } from './bench'

export interface BenchClient {
  status(): Promise<WasmStatus>
  run(workloadId: string, size: number, handlers?: { onSample?: (sideId: string, ms: number, index: number) => void }): Promise<WorkloadResult>
  race(workloadId: string, size: number, onProgress: (sideId: string, fraction: number, chunk: unknown) => void): Promise<void>
  cancel(): void
  dispose(): void
}

interface Pending {
  resolve: (value: never) => void
  reject: (error: Error) => void
  onSample?: (sideId: string, ms: number, index: number) => void
  onProgress?: (sideId: string, fraction: number, chunk: unknown) => void
}

interface Port {
  post(message: unknown): void
  terminate(): void
}

export function createBenchClient(): BenchClient {
  const pending = new Map<number, Pending>()
  let port: Port | null = null
  let nextId = 1
  let statusCache: Promise<WasmStatus> | null = null

  function failAll(error: Error) {
    const all = [...pending.values()]
    pending.clear()
    all.forEach(p => p.reject(error))
  }

  function onMessage(m: { type: string; id?: number; [key: string]: unknown }) {
    if (m.type === 'status') {
      const p = pending.get(0)
      pending.delete(0)
      p?.resolve({ wasm: m.wasm, error: m.error, info: m.info } as never)
      return
    }
    const p = pending.get(m.id as number)
    if (!p) return
    if (m.type === 'sample') p.onSample?.(m.side as string, m.ms as number, m.index as number)
    else if (m.type === 'progress') p.onProgress?.(m.side as string, m.fraction as number, m.chunk)
    else {
      pending.delete(m.id as number)
      if (m.type === 'result') p.resolve(m.result as never)
      else p.reject(new Error(String(m.message)))
    }
  }

  function spawn(): Port {
    if (typeof Worker !== 'undefined') {
      const worker = new Worker(new URL('./bench.worker.ts', import.meta.url), { type: 'module' })
      worker.onmessage = e => onMessage(e.data)
      worker.onerror = e => {
        port = null
        worker.terminate()
        failAll(new Error(e.message || 'The benchmark worker failed'))
      }
      return { post: m => worker.postMessage(m), terminate: () => worker.terminate() }
    }
    // No Worker: same code path on the main thread. Imported lazily to avoid an import cycle.
    const host = import('./bench-workloads').then(mod => mod.createBenchHost(m => onMessage(m as never)))
    return {
      post: m => void host.then(h => h.handle(m as never)),
      terminate: () => void host.then(h => h.cancel()),
    }
  }

  function send<T>(id: number, message: Record<string, unknown>, extra: Partial<Pending> = {}): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      pending.set(id, { resolve: resolve as never, reject, ...extra })
      ;(port ??= spawn()).post({ ...message, id })
    })
  }

  return {
    status() {
      if (!statusCache) {
        statusCache = send<WasmStatus>(0, { type: 'status' })
        statusCache.catch(() => { statusCache = null })
      }
      return statusCache
    },
    run(workload, size, handlers) {
      return send<WorkloadResult>(nextId++, { type: 'run', workload, size }, { onSample: handlers?.onSample })
    },
    race(workload, size, onProgress) {
      return send<void>(nextId++, { type: 'race', workload, size }, { onProgress })
    },
    cancel() {
      port?.terminate()
      port = null
      failAll(new Error('cancelled'))
    },
    dispose() {
      port?.terminate()
      port = null
      failAll(new Error('disposed'))
    },
  }
}
