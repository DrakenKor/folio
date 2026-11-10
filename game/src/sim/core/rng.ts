import type { RngState, World } from './types'

function rotate(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0
}

function seedStream(seed: number, stream: string): RngState {
  let value = 2166136261
  for (const byte of new TextEncoder().encode(`${seed}:${stream}`)) value = Math.imul(value ^ byte, 16777619) >>> 0
  const state: RngState = [0, 0, 0, 0]
  for (let i = 0; i < 4; i++) {
    value = (value + 0x9e3779b9) >>> 0
    let mixed = Math.imul(value ^ (value >>> 16), 0x21f0aaad)
    mixed = Math.imul(mixed ^ (mixed >>> 15), 0x735a2d97)
    state[i] = (mixed ^ (mixed >>> 15)) >>> 0
  }
  if (state.every(word => word === 0)) state[0] = 1
  return state
}

function draw(world: World, stream: string): number {
  if (!Object.hasOwn(world.rng, stream)) {
    Object.defineProperty(world.rng, stream, { value: seedStream(world.seed, stream), writable: true, enumerable: true, configurable: true })
  }
  const s = world.rng[stream]!
  const result = Math.imul(rotate(Math.imul(s[1], 5), 7), 9) >>> 0
  const temporary = s[1] << 9
  s[2] = (s[2] ^ s[0]) >>> 0
  s[3] = (s[3] ^ s[1]) >>> 0
  s[1] = (s[1] ^ s[2]) >>> 0
  s[0] = (s[0] ^ s[3]) >>> 0
  s[2] = (s[2] ^ temporary) >>> 0
  s[3] = rotate(s[3], 11)
  return result
}

/** Draw a xoshiro128** value in [0, 1) from an independent named stream. */
export function rngFloat(world: World, stream: string): number {
  return draw(world, stream) / 4294967296
}

/** Draw an unbiased integer in [0, n), using rejection for uneven ranges. */
export function rngInt(world: World, stream: string, n: number): number {
  if (!Number.isInteger(n) || n < 1 || n > 4294967296) throw new RangeError('n must be an integer in [1, 2^32]')
  const limit = 4294967296 - (4294967296 % n)
  let value: number
  do { value = draw(world, stream) } while (value >= limit)
  return value % n
}
