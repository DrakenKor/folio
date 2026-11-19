import { restore, serialize } from '../sim/core/index'
import type { SaveStatus, World } from '../sim/core/index'
import { buildScenario } from '../sim/scenarios'
import { decode } from './encoding'

const RELOAD_KEY = 'folio.arpg.dev.snapshot'
const GRAPHICS_KEY = 'folio.arpg.graphics.snapshot'
type SaveIdentity = Pick<SaveStatus, 'code' | 'generation'> & { playerEntry: boolean }
interface Saved {
  entry: string
  snapshot: string
  paused: boolean
  playerSession: boolean
  save?: SaveIdentity
}

function entryKey(url: URL): string {
  const entry = new URL(url)
  entry.hash = ''
  entry.searchParams.delete('fresh')
  return entry.href
}

export function storeSession(url: URL, world: World, paused: boolean, playerSession: boolean, save?: SaveIdentity): void {
  const saved: Saved = { entry: entryKey(url), snapshot: serialize(world), paused, playerSession, save }
  try { sessionStorage.setItem(save ? GRAPHICS_KEY : RELOAD_KEY, JSON.stringify(saved)) }
  catch { /* Recovery storage can be unavailable. */ }
}

function takeSession(key: string, url: URL): Saved | undefined {
  try {
    const text = sessionStorage.getItem(key)
    sessionStorage.removeItem(key)
    if (text) {
      const saved: Saved = JSON.parse(text)
      if (saved.entry === entryKey(url)) return saved
    }
  } catch { /* Ignore an unavailable or unreadable recovery record. */ }
}

export async function initialWorld(url: URL) {
  const fragment = new URLSearchParams(url.hash.slice(1)).get('snap')
  const scenario = url.searchParams.get('scenario')
  const graphics = takeSession(GRAPHICS_KEY, url)
  const reload = import.meta.env.DEV ? takeSession(RELOAD_KEY, url) : undefined
  const paused = url.searchParams.get('paused') === '1'
  const playerEntry = !fragment && scenario === null && graphics?.save?.playerEntry !== false
  const world = fragment ? restore(await decode(fragment)) : buildScenario(scenario ?? 'm3a-clearing', Number(url.searchParams.get('seed') ?? 1))
  return { world, paused, playerEntry, recovery: fragment ? undefined : graphics ?? (!playerEntry && url.searchParams.get('fresh') !== '1' ? reload : undefined) }
}

/** Only reinstall player-entry recovery after the current document checks the save under its writer lock. */
export function recoverSession(saved: Saved | undefined, playerEntry: boolean, status: SaveStatus) {
  if (!saved) return
  if (playerEntry && (!saved.save || saved.save.generation !== status.generation ||
    !(saved.save.code === 'ready' && status.writable || saved.save.code === 'read-only' && status.code === 'read-only'))) return
  try { return { world: restore(saved.snapshot), paused: saved.paused, playerSession: saved.playerSession, cancelHeld: !!saved.save } }
  catch { /* The snapshot may use an incompatible schema after a reload. */ }
}
