import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import type { WasmExports } from '@/lib/wasm'

// Loads the built binary from public/wasm in Node. Returns null when it has not
// been built, so tests can skip visibly with it.skipIf(!wasm).
export type DiskWasm = WasmExports & Record<string, unknown>

export async function loadWasmFromDisk(): Promise<DiskWasm | null> {
  const dir = path.resolve(__dirname, '../../../public/wasm')
  const glue = path.join(dir, 'portfolio_wasm.js')
  const bin = path.join(dir, 'portfolio_wasm_bg.wasm')
  if (!fs.existsSync(glue) || !fs.existsSync(bin)) return null
  const mod = await import(/* @vite-ignore */ pathToFileURL(glue).href)
  mod.initSync({ module: fs.readFileSync(bin) })
  return mod as DiskWasm
}
