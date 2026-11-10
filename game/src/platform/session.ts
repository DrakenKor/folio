import { restore, serialize } from '../sim/core/index'
import type { World } from '../sim/core/index'
import { buildScenario } from '../sim/scenarios'
import { decode } from './encoding'

const RELOAD_KEY = 'folio.arpg.dev.snapshot'
const GRAPHICS_KEY = 'folio.arpg.graphics.snapshot'
interface Saved { snapshot: string; paused: boolean }

export function storeSession(world: World, paused: boolean, graphics = false): void {
  try {
    sessionStorage.setItem(graphics ? GRAPHICS_KEY : RELOAD_KEY, JSON.stringify({ snapshot: serialize(world), paused }))
  } catch (error) { console.warn('Could not keep the reload snapshot', error) }
}

/** Explicit snapshot links take precedence over development reload state. */
export async function initialWorld(url: URL): Promise<{ world: World; paused: boolean }> {
  const fragment = new URLSearchParams(url.hash.slice(1)).get('snap')
  if (fragment) return { world: restore(await decode(fragment)), paused: url.searchParams.get('paused') === '1' }
  const keys = [GRAPHICS_KEY]
  if (import.meta.env.DEV && url.searchParams.get('fresh') !== '1') keys.push(RELOAD_KEY)
  for (const key of keys) {
    try {
      const text = sessionStorage.getItem(key)
      sessionStorage.removeItem(key)
      if (text) {
        const saved: Saved = JSON.parse(text)
        return { world: restore(saved.snapshot), paused: saved.paused || url.searchParams.get('paused') === '1' }
      }
    } catch (error) { console.warn('Could not restore the reload snapshot', error) }
  }
  const seed = Number(url.searchParams.get('seed') ?? 1)
  return { world: buildScenario(url.searchParams.get('scenario') ?? 'meadow-start', seed), paused: url.searchParams.get('paused') === '1' }
}
