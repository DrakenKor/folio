import { agree, measure, mulberry32 } from './bench'
import type { Agreement, Side } from './bench'
import { runJs, runRust } from './image-filters'
import type { FilterCall } from './image-filters'
import { loadWasm, wasmInfo } from './wasm'
import type { WasmExports } from './wasm'

export type Engine = 'rust' | 'js' | 'both'

export type ImageRequest =
  | { type: 'run'; id: number; call: FilterCall; engine: Engine; w: number; h: number; buffer: ArrayBuffer }
  | { type: 'sweep'; id: number; call: FilterCall }

export type ImageReply =
  | { type: 'status'; wasm: boolean; rawBytes: number | null }
  | { type: 'result'; id: number; buffer: ArrayBuffer; rustMs: number | null; jsMs: number | null; maxError: number | null }
  | { type: 'point'; id: number; size: number; rustMs: number | null; jsMs: number; valid: boolean }
  | { type: 'done'; id: number }
  | { type: 'error'; id: number; message: string }

export const SWEEP_SIZES = [256, 512, 1024, 2048, 4096]

const scope = self as unknown as {
  postMessage(message: ImageReply, transfer?: Transferable[]): void
  onmessage: ((event: MessageEvent<ImageRequest>) => void) | null
}

// The load starts once; a failure is remembered and JavaScript still works
const ready = loadWasm().then(
  wasm => wasm as WasmExports | null,
  () => null
)

function maxDifference(a: Uint8Array, b: Uint8Array): number {
  let max = 0
  for (let i = 0; i < a.length; i++) {
    const d = Math.abs(a[i] - b[i])
    if (d > max) max = d
  }
  return max
}

// One timed call per engine on identical pixels. For Rust the span includes
// the copy into and out of WebAssembly memory.
function run(msg: Extract<ImageRequest, { type: 'run' }>, wasm: WasmExports | null) {
  const { call, engine, w, h } = msg
  const input = new Uint8Array(msg.buffer)
  let rustMs: number | null = null
  let jsMs: number | null = null
  let rustOut: Uint8Array | null = null
  let jsOut: Uint8Array | null = null

  if (wasm && engine !== 'js') {
    rustOut = engine === 'both' ? input.slice() : input
    const t0 = performance.now()
    runRust(wasm, call, rustOut, w, h)
    rustMs = performance.now() - t0
  }
  if (engine !== 'rust' || !wasm) {
    jsOut = input
    const t0 = performance.now()
    runJs(call, jsOut, w, h)
    jsMs = performance.now() - t0
  }
  const out = rustOut ?? jsOut!
  const maxError = rustOut && jsOut ? maxDifference(rustOut, jsOut) : null
  scope.postMessage({ type: 'result', id: msg.id, buffer: out.buffer as ArrayBuffer, rustMs, jsMs, maxError }, [out.buffer as ArrayBuffer])
}

// The Phase 2 size sweep: bench.ts on square seeded images, both engines
async function sweep(msg: Extract<ImageRequest, { type: 'sweep' }>, wasm: WasmExports | null) {
  for (const size of SWEEP_SIZES) {
    const next = mulberry32(size)
    const base = new Uint8Array(size * size * 4)
    for (let i = 0; i < base.length; i++) base[i] = i % 4 === 3 ? 255 : Math.floor(next() * 256)
    const sides: Side<Uint8Array, Uint8Array>[] = []
    if (wasm) {
      sides.push({
        id: 'rust',
        label: 'Rust',
        prepare: () => base.slice(),
        run: d => {
          runRust(wasm, msg.call, d, size, size)
          return d
        }
      })
    }
    sides.push({
      id: 'js',
      label: 'JavaScript',
      prepare: () => base.slice(),
      run: d => {
        runJs(msg.call, d, size, size)
        return d
      }
    })
    const result = await measure(sides, {
      samples: size >= 4096 ? 3 : size >= 2048 ? 5 : 11,
      agree: agree.within1 as unknown as (a: unknown, b: unknown) => Agreement
    })
    scope.postMessage({
      type: 'point',
      id: msg.id,
      size,
      rustMs: result.stats.rust?.median ?? null,
      jsMs: result.stats.js.median,
      valid: result.valid
    })
  }
  scope.postMessage({ type: 'done', id: msg.id })
}

scope.onmessage = async event => {
  const msg = event.data
  const wasm = await ready
  try {
    if (msg.type === 'run') run(msg, wasm)
    else await sweep(msg, wasm)
  } catch (e) {
    scope.postMessage({ type: 'error', id: msg.id, message: e instanceof Error ? e.message : String(e) })
  }
}

// Announce the load as soon as it settles, before any request arrives
void ready.then(wasm => scope.postMessage({ type: 'status', wasm: wasm !== null, rawBytes: wasmInfo()?.rawBytes ?? null }))
