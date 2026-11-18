import { afterEach, expect, it, vi } from 'vitest'
import { fixture, neutralContent } from '../../sim/acceptance/m2/fixtures'
import { restore, serialize } from '../../sim/core/snapshot'
import type { CharacterData, World } from '../../sim/core/types'
import legacy from './fixtures/schema-0.json'
import { SaveController, SAVE_MAX_BYTES } from './index'

afterEach(() => vi.unstubAllGlobals())

function session(initial: string | null, fault?: 'quota' | 'security' | 'read') {
  const content = neutralContent()
  const fresh = () => fixture(content, true).world
  let world = fresh()
  let bytes = initial
  let writes = 0
  const project = (source: World): CharacterData => ({
    character: structuredClone(source.entities[0]!.character!), contentVersion: content.m2!.version,
    seed: source.seed, lootRng: [...source.rng.loot!], nextItemId: source.nextItemId, questFlags: {}, settings: {}
  })
  const save = new SaveController({
    build: 'platform-test', content, getWorld: () => world, replaceWorld: next => { world = next },
    createFreshWorld: fresh, exportCharacter: project,
    loadCharacter(value) {
      const data = value as CharacterData
      const next = fresh()
      next.entities[0]!.character = data.character
      next.seed = data.seed
      next.rng.loot = data.lootRng
      next.nextItemId = data.nextItemId
      return { world: restore(serialize(next)), refunds: [] }
    },
    storage: {
      getItem() {
        if (fault === 'security') throw new DOMException('Denied', 'SecurityError')
        if (fault === 'read') throw new Error('Read failed')
        return bytes
      },
      setItem(_, text) {
        writes++
        if (fault === 'quota') throw new DOMException('Full', 'QuotaExceededError')
        bytes = text
      },
      removeItem() { throw new Error('Unexpected removal') }
    }
  })
  return { save, bytes: () => bytes, writes: () => writes }
}

it('migrates the schema 0 fixture and keeps all missing-lock operations in memory', async () => {
  vi.stubGlobal('navigator', {})
  const text = JSON.stringify(legacy)
  const { save, bytes, writes } = session(text)
  try {
    expect(await save.load()).toMatchObject({ ok: true, status: { code: 'read-only', generation: 7 } })
    const migrated = JSON.parse(save.export())
    expect(migrated).toMatchObject({ schema: 1, nextItemId: 12, contentVersion: 'qa-v1', character: legacy.character })
    expect(migrated.lootRng).toHaveLength(4)
    expect((await save.import(save.export())).ok).toBe(true)
    expect((await save.reset()).ok).toBe(true)
    expect((await save.flush()).ok).toBe(false)
    expect(bytes()).toBe(text)
    expect(writes()).toBe(0)
  } finally { save.dispose() }
})

it('reports old content refunds and validates the repaired projection', async () => {
  const { save } = session(null)
  try {
    expect((await save.load()).ok).toBe(true)
    const old = JSON.parse(save.export())
    old.contentVersion = 'old'
    old.character.graph.allocations = ['1,0', '7,0', '2,1']
    old.character.points = 1
    old.character.graph.activeShapes = ['hexagon-0']
    old.character.loadout = ['gone', 'gone-too', 'third', null, null, null]
    old.character.folds = { 'fold-dart': ['lost-fold'] }
    old.character.items[0].baseId = 'lost-base'
    old.character.items[0].affixes = ['offensive', 'utility'].map(category => ({ category, familyId: 'lost', tier: 2, roll: 8 }))
    old.generation = 999
    const result = await save.import(JSON.stringify(old))
    expect(result).toMatchObject({ ok: true, status: { generation: 1, writable: true } })
    expect(result.status.refunds).toHaveLength(10)
    const { character } = JSON.parse(save.export())
    expect(character).toMatchObject({ points: 3, graph: { allocations: ['1,0'], activeShapes: [] },
      loadout: ['span-cut', 'fold-dart', null, null, null, null], folds: { 'fold-dart': [] } })
    expect(character.items[0]).toMatchObject({ baseId: 'qa-weapon', affixes: [
      { familyId: 'qa-flat', tier: 1, roll: 4 }, { familyId: 'qa-health', tier: 1, roll: 8 }
    ] })
  } finally { save.dispose() }
})

it.each(['a', '界'])('checks both byte budgets at the exact boundary for %s', async symbol => {
  const { save, bytes } = session(null)
  try {
    expect((await save.load()).ok).toBe(true)
    const envelope = JSON.parse(save.export())
    envelope.build = ''
    const base = JSON.stringify(envelope)
    const count = Math.floor(Math.min((SAVE_MAX_BYTES - Buffer.byteLength(base)) / Buffer.byteLength(symbol),
      (SAVE_MAX_BYTES - base.length * 2) / (symbol.length * 2)))
    envelope.build = symbol.repeat(count)
    expect((await save.import(JSON.stringify(envelope))).ok).toBe(true)
    const accepted = bytes()
    envelope.build += symbol
    expect(await save.import(JSON.stringify(envelope))).toMatchObject({ ok: false, reason: 'oversize' })
    expect(bytes()).toBe(accepted)
  } finally { save.dispose() }
})

it.each([['quota', 'quota'], ['security', 'security'], ['read', 'read-failed']] as const)(
  'preserves the prior bytes and offers save text on %s failure', async (fault, reason) => {
    const prior = JSON.stringify({ ...legacy, schema: 1, nextItemId: 12, contentVersion: 'qa-v1', lootRng: [1, 2, 3, 4] })
    const { save, bytes } = session(prior, fault)
    try {
      const load = await save.load()
      const result = fault === 'quota' ? await save.flush() : load
      expect(result).toMatchObject({ ok: false, reason, status: { writable: false } })
      expect(JSON.parse(save.export())).toMatchObject({ schema: 1, format: 'folio.arpg.save' })
      expect(bytes()).toBe(prior)
    } finally { save.dispose() }
  })

it('commits the migrated fixture once under the writer lock', async () => {
  const { save, bytes, writes } = session(JSON.stringify(legacy))
  try {
    expect(await save.load()).toMatchObject({ ok: true, status: { code: 'ready', generation: 8 } })
    expect(JSON.parse(bytes()!)).toMatchObject({ schema: 1, nextItemId: 12, character: legacy.character })
    await save.load()
    expect(writes()).toBe(1)
  } finally { save.dispose() }
})

it('preserves unreadable bytes until an explicit reset installs a fresh save', async () => {
  const { save, bytes } = session('{')
  try {
    expect(await save.load()).toMatchObject({ ok: false, reason: 'corrupt' })
    expect((await save.flush()).ok).toBe(false)
    expect(bytes()).toBe('{')
    expect(await save.reset()).toMatchObject({ ok: true, status: { writable: true, generation: 1 } })
    expect(JSON.parse(bytes()!).character.points).toBe(4)
  } finally { save.dispose() }
})
