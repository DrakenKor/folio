import { describe, expect, it } from 'vitest'
import { hashWorld, restore, serialize } from '../sim/core/index'
import { buildScenario } from '../sim/scenarios'
import { decode, encode } from './encoding'

describe('snapshot encoding', () => {
  it('round trips canonical snapshots through gzip and URL-safe base64', async () => {
    const world = buildScenario('meadow-start', 7)
    const snapshot = serialize(world)
    const encoded = await encode(snapshot)
    expect(encoded).toMatch(/^[\w-]+$/)
    expect(await decode(encoded)).toBe(snapshot)
    expect(hashWorld(restore(await decode(encoded)))).toBe(hashWorld(world))
  })

  it('preserves Unicode and rejects invalid or non-gzip payloads', async () => {
    const text = 'Meadow — 草原 '.repeat(10000)
    expect(await decode(await encode(text))).toBe(text)
    await expect(decode('not base64!')).rejects.toThrow()
    await expect(decode('YWJj')).rejects.toThrow()
  })
})
