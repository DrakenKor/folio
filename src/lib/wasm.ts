export interface WasmExports {
  convolve(data: Uint8Array, width: number, height: number, kernel: Float64Array | number[], ksize: number, divisor: number, bias: number): void
  color_matrix(data: Uint8Array, m: Float64Array | number[]): void
  gaussian_blur(data: Uint8Array, width: number, height: number, sigma: number): void
  sobel(data: Uint8Array, width: number, height: number): void
  sha256(data: Uint8Array): Uint8Array
  crc32(data: Uint8Array): number
  fnv1a_hash(input: string): number
  simple_hash(input: string): number
  mandelbrot(width: number, height: number, maxIter: number, out: Uint8Array): void
  mandelbrot_rows(width: number, height: number, maxIter: number, y0: number, y1: number, out: Uint8Array): void
  nbody(positions: Float64Array, velocities: Float64Array, masses: Float64Array, steps: number, dt: number): void
  matrix_multiply(a: Float64Array, b: Float64Array, rowsA: number, colsA: number, colsB: number): Float64Array
  prime_sieve(limit: number): Uint32Array
  sort_array(arr: Float64Array): void
  fibonacci(n: number): bigint
  reverse_string(s: string): string
  count_words(s: string): number
}

export interface WasmInfo {
  loadMs: number
  rawBytes: number
  encodedBytes: number | null
}

interface WasmGlue extends WasmExports {
  default(init: { module_or_path: BufferSource }): Promise<unknown>
}

let loaded: Promise<WasmExports> | null = null
let info: WasmInfo | null = null

async function load(): Promise<WasmExports> {
  const start = performance.now()
  const origin = self.location.origin
  const jsUrl = `${origin}/wasm/portfolio_wasm.js`
  const wasmUrl = `${origin}/wasm/portfolio_wasm_bg.wasm`

  let glue: WasmGlue
  try {
    glue = (await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ `${origin}/wasm/portfolio_wasm.js`)) as WasmGlue
  } catch (e) {
    throw new Error(`Could not load the WASM glue script ${jsUrl}: ${e instanceof Error ? e.message : String(e)}`)
  }

  let bytes: ArrayBuffer
  try {
    const res = await fetch(wasmUrl)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    bytes = await res.arrayBuffer()
  } catch (e) {
    throw new Error(`Could not fetch the WASM binary ${wasmUrl}: ${e instanceof Error ? e.message : String(e)}`)
  }

  try {
    await glue.default({ module_or_path: bytes })
  } catch (e) {
    throw new Error(`Could not instantiate the WASM module: ${e instanceof Error ? e.message : String(e)}`)
  }

  const entries = performance.getEntriesByName(wasmUrl, 'resource') as PerformanceResourceTiming[]
  const encoded = entries.length > 0 ? entries[entries.length - 1].encodedBodySize : 0
  info = {
    loadMs: performance.now() - start,
    rawBytes: bytes.byteLength,
    encodedBytes: encoded > 0 ? encoded : null,
  }
  return glue
}

export function loadWasm(): Promise<WasmExports> {
  if (!loaded) {
    loaded = load().catch((e: Error) => {
      loaded = null
      throw e
    })
  }
  return loaded
}

export function wasmInfo(): WasmInfo | null {
  return info
}
