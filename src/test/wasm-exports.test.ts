import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { loadWasmFromDisk } from './helpers/wasm-from-disk'

const wasm = await loadWasmFromDisk()
const hex = (b: Uint8Array) => Buffer.from(b).toString('hex')

// Exports wrapped by wasm-core-loader.ts, which the physics demo still imports
const CORE_EXPORTS = [
  'greet', 'performance_test', 'force_gc', 'WASMModule', 'fibonacci', 'prime_sieve', 'matrix_multiply',
  'sum_array', 'sort_array', 'find_max', 'find_min', 'reverse_string', 'count_words', 'safe_divide',
  'get_memory_usage', 'Particle', 'ParticleSystem', 'physics_performance_test',
]

describe.skipIf(!wasm)('wasm exports', () => {
  it('sha256("abc") matches the known vector', () => {
    expect(hex(wasm!.sha256(new TextEncoder().encode('abc')))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })

  it('sha256 matches node:crypto for empty, ascii and emoji input', () => {
    for (const s of ['', 'abc', 'café \u{1F600}']) {
      const bytes = new TextEncoder().encode(s)
      expect(hex(wasm!.sha256(bytes))).toBe(createHash('sha256').update(bytes).digest('hex'))
    }
  })

  it('still exports every name the physics demo reaches through wasm-core-loader', () => {
    for (const name of CORE_EXPORTS) expect(wasm![name], name).toBeDefined()
  })
})
