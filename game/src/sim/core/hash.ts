import { serialize } from './snapshot'
import type { World } from './types'

const encoder = new TextEncoder()

/** FNV-1a over the UTF-8 bytes of the canonical snapshot envelope. */
export function hashWorld(world: World): string {
  let hash = 2166136261
  for (const byte of encoder.encode(serialize(world))) hash = Math.imul(hash ^ byte, 16777619) >>> 0
  return hash.toString(16).padStart(8, '0')
}
