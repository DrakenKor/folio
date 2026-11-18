import { afterAll, describe, expect, it } from 'vitest'
// eslint-disable-next-line no-restricted-imports -- Acceptance exercises the public platform save boundary, not production simulation code.
import { SaveController, SAVE_KEY } from '../../../platform/saves'
import { canonical, exportCharacter, loadCharacter, SAVE_FORMAT, SAVE_MAX_BYTES, serialize, restore } from '../../core'
import type { CharacterData, SaveEnvelope, SaveResult } from '../../core'
import { balanceFixtures } from '../../../../tools/m2-fixtures'
import { fixture, neutralContent, succeeds } from './fixtures'

const nativeLocks = globalThis.navigator.locks
const navigatorPrototype = Object.getPrototypeOf(globalThis.navigator)
const locksDescriptor = Object.getOwnPropertyDescriptor(navigatorPrototype, 'locks')!
// Absence is real API removal, matching the CDP case; no lock implementation is mocked.
Reflect.deleteProperty(navigatorPrototype, 'locks')
afterAll(() => { Object.defineProperty(navigatorPrototype, 'locks', locksDescriptor) })

function saveFixture() {
  const { world, player } = fixture(neutralContent(), true)
  player.character!.rank = 21; player.character!.points = 0
  player.character!.graph.allocations = [...balanceFixtures[0].allocations]; player.character!.graph.activeShapes = [...balanceFixtures[0].activeShapes]
  player.character!.items[0]!.affixes = [{ familyId: 'qa-flat', category: 'offensive', tier: 2, roll: 8 }, { familyId: 'qa-health', category: 'utility', tier: 2, roll: 15 }]
  player.character!.folds = { 'fold-dart': ['long-pleat', 'splay-pleat'] }
  for (let n = 0; n < 60; n++) {
    const id = world.nextItemId++
    player.character!.items.push({ id, baseId: 'qa-weapon', role: 'weapon', affixes: [{ familyId: 'qa-flat', category: 'offensive', tier: 2, roll: 8 }, { familyId: 'qa-health', category: 'utility', tier: 2, roll: 15 }] })
    player.character![n < 30 ? 'inventory' : 'stash'].push(id)
  }
  for (const role of ['offhand', 'coat', 'boots', 'survey-tally'] as const) {
    const id = world.nextItemId++
    player.character!.items.push({ id, baseId: `qa-${role}`, role, affixes: role === 'survey-tally' ? [{ familyId: 'qa-cast-flat', category: 'offensive', tier: 2, roll: 4 }, { familyId: 'qa-reach', category: 'utility', tier: 2, roll: 8 }] : role === 'coat' ? [{ familyId: 'qa-coat-boost', category: 'offensive', tier: 2, roll: 8 }, { familyId: 'qa-health', category: 'utility', tier: 2, roll: 15 }] : [{ familyId: 'qa-health', category: 'utility', tier: 2, roll: 15 }] })
    player.character!.equipment[role] = id
  }
  succeeds('populated snapshot validation', () => restore(serialize(world)))
  const data: CharacterData = { contentVersion: world.content.m2!.version, seed: world.seed, character: structuredClone(player.character!), lootRng: [...world.rng.loot!], nextItemId: world.nextItemId, questFlags: {}, settings: {} }
  const envelope: SaveEnvelope = { ...data, format: SAVE_FORMAT, schema: 1, generation: 7, build: 'qa-baseline' }
  return { world, data, envelope }
}
function storage(initial: string | null = null, fault?: 'quota' | 'security' | 'read') {
  let bytes = initial
  const mutations: string[] = []
  return { mutations, bytes: () => bytes,
    getItem(key: string) { expect(key).toBe(SAVE_KEY); if (fault === 'read' || fault === 'security') throw Object.assign(new Error('injected read failure'), { name: fault === 'security' ? 'SecurityError' : 'Error' }); return bytes },
    setItem(key: string, text: string) { expect(key).toBe(SAVE_KEY); if (fault === 'quota') throw Object.assign(new Error('injected quota'), { name: 'QuotaExceededError' }); mutations.push(text); bytes = text },
    removeItem(key: string) { expect(key).toBe(SAVE_KEY); mutations.push('remove'); bytes = null } }
}
function controller(initial: string | null = null, fault?: 'quota' | 'security' | 'read', locks?: LockManager) {
  const f = saveFixture(); let current = f.world; const store = storage(initial, fault)
  const saves = new SaveController({ build: 'qa-baseline', content: f.world.content, getWorld: () => current, replaceWorld: next => { current = next }, exportCharacter, loadCharacter, storage: store, locks })
  return { ...f, saves, store, current: () => current }
}
async function outcome(call: () => Promise<SaveResult>) {
  let result: SaveResult | undefined; let error: unknown
  try { result = await call() } catch (caught) { error = caught }
  expect(error, `save boundary must return a typed result: ${String(error ?? '')}`).toBeUndefined()
  return result!
}

describe('M2 character persistence and validation', () => {
  it('S01 populated projection round trip: 60 stored items, shapes, folds, gear, RNG/id; fresh rested clearing', () => {
    const { world, data } = saveFixture()
    const projected = succeeds('exportCharacter', () => exportCharacter(world))
    expect(projected).toEqual(data)
    const maximum = canonical({ ...projected, format: SAVE_FORMAT, schema: 1, generation: 1, build: 'qa-baseline' })
    expect(new TextEncoder().encode(maximum).length).toBeLessThanOrEqual(SAVE_MAX_BYTES)
    expect(maximum.length * 2).toBeLessThanOrEqual(SAVE_MAX_BYTES)
    expect(Object.keys(projected).sort()).toEqual(['character', 'contentVersion', 'lootRng', 'nextItemId', 'questFlags', 'seed', 'settings'])
    const loaded = succeeds('loadCharacter', () => loadCharacter(projected, world.content))
    expect(loaded.refunds).toEqual([]); expect(loaded.world.scenario).toBe('m2-clearing')
    expect(loaded.world.encounter!.phase).toBe('rest'); expect(loaded.world.tick).toBe(0)
    expect(loaded.world.projectiles).toEqual([]); expect(loaded.world.ailments).toEqual([]); expect(loaded.world.groundDrops).toEqual([])
    const player = loaded.world.entities.find(e => e.id === loaded.world.playerId)!
    expect(player.character).toEqual(data.character); expect(player.health).toBe(player.maxHealth)
  })

  it('S02 v1 canonical envelope, platform generation excluded from character/simulation state', async () => {
    const { envelope } = saveFixture(); const c = controller(canonical(envelope))
    try {
      const result = await outcome(() => c.saves.load()); expect(result.ok).toBe(true)
      expect(c.saves.status()).toMatchObject({ code: 'read-only', writable: false, generation: 7 })
      const text = succeeds('save export', () => c.saves.export())
      expect(text).toBe(canonical(JSON.parse(text)))
      expect(JSON.parse(text)).toMatchObject({ format: SAVE_FORMAT, schema: 1, generation: 7 })
      expect(exportCharacter(c.current())).toEqual(c.data)
    } finally { c.saves.dispose() }
  })

  it('S03 fixture v0 migration deterministically restores version, seeded loot RNG and max item id+1', async () => {
    const { envelope } = saveFixture()
    const { contentVersion: _version, lootRng: _rng, nextItemId: _id, ...legacy } = envelope
    const text = canonical({ ...legacy, schema: 0 }); const c = controller(text)
    try {
      expect((await outcome(() => c.saves.load())).ok).toBe(true)
      const migrated = JSON.parse(succeeds('migrated export', () => c.saves.export()))
      expect(migrated).toMatchObject({ schema: 1, contentVersion: c.data.contentVersion, nextItemId: 66 })
      expect(migrated.lootRng).toHaveLength(4)
      expect(migrated.lootRng.every((word: number) => Number.isInteger(word) && word >= 0 && word <= 0xffffffff)).toBe(true)
      expect(migrated.lootRng.some((word: number) => word > 0)).toBe(true)
      for (const seed of [envelope.seed, envelope.seed + 1]) {
        const other = controller(canonical({ ...legacy, schema: 0, seed }))
        try {
          expect((await outcome(() => other.saves.load())).ok).toBe(true)
          const rng = JSON.parse(succeeds('repeat migration export', () => other.saves.export())).lootRng
          if (seed === envelope.seed) expect(rng).toEqual(migrated.lootRng)
          else expect(rng).not.toEqual(migrated.lootRng)
        } finally { other.saves.dispose() }
      }
      expect(c.store.bytes()).toBe(text); expect(c.store.mutations).toEqual([])
    } finally { c.saves.dispose() }
  })

  it.each(['nodes', 'shapes', 'folds', 'skills', 'bases', 'affixes', 'utility-affixes'] as const)('S04 removed content %s refunds/replaces with readable results', kind => {
    const { world, data } = saveFixture(); const changed = structuredClone(data); changed.contentVersion = 'qa-old'
    if (kind === 'nodes') {
      changed.character.graph.allocations = ['1,0', '2,0', '3,0', '4,0', '5,0', '6,0', '7,0', '7,-1']; changed.character.points = 16; changed.character.graph.activeShapes = []
    }
    if (kind === 'shapes') changed.character.graph.activeShapes = ['removed-shape']
    if (kind === 'folds') changed.character.folds['fold-dart'] = ['removed-fold']
    if (kind === 'skills') changed.character.loadout = ['removed-primary', 'removed-secondary', 'removed-third', null, null, null]
    if (kind === 'bases') changed.character.items[0]!.baseId = 'removed-weapon'
    if (kind === 'affixes') changed.character.items[1]!.affixes[0]!.familyId = 'removed-affix'
    if (kind === 'utility-affixes') changed.character.items[1]!.affixes[1]!.familyId = 'removed-utility'
    const result = succeeds(`removed ${kind}`, () => loadCharacter(changed, world.content)); const character = result.world.entities.find(e => e.id === result.world.playerId)!.character!
    expect(result.refunds.length).toBeGreaterThan(0); expect(result.refunds.every(text => text.length > 0)).toBe(true)
    if (kind === 'nodes') { expect(character.graph.allocations).toEqual(['1,0', '2,0', '3,0', '4,0', '5,0', '6,0']); expect(character.points).toBe(18) }
    if (kind === 'shapes') expect(character.graph.activeShapes).toEqual([])
    if (kind === 'folds') expect(character.folds['fold-dart']).toEqual([])
    if (kind === 'skills') expect(character.loadout).toEqual(['span-cut', 'fold-dart', null, null, null, null])
    if (kind === 'bases') { expect(character.items[0]!.baseId).toBe('qa-weapon'); expect(character.items[0]!.affixes).toEqual(changed.character.items[0]!.affixes) }
    if (kind === 'affixes') expect(character.items[1]!.affixes[0]).toEqual({ familyId: 'qa-flat', category: 'offensive', tier: 1, roll: 4 })
    if (kind === 'utility-affixes') expect(character.items[1]!.affixes[1]).toEqual({ familyId: 'qa-health', category: 'utility', tier: 1, roll: 8 })
  })

  it.each([
    ['corrupt JSON', '{', 'corrupt'], ['future schema', JSON.stringify({ format: SAVE_FORMAT, schema: 99 }), 'future-schema'],
    ['wrong format', JSON.stringify({ format: 'folio.arpg.snapshot', schema: 1 }), 'corrupt']
  ])('S05 %s preserves bytes/state and disables writes', async (_name, text, code) => {
    const c = controller(text)
    try {
      const before = serialize(c.current()); const result = await outcome(() => c.saves.load())
      expect(result).toMatchObject({ ok: false, reason: code }); expect(c.saves.status().writable).toBe(false)
      expect(c.saves.status().text).toBe(text); expect(c.store.bytes()).toBe(text); expect(serialize(c.current())).toBe(before)
      await outcome(() => c.saves.flush()); expect(c.store.mutations).toEqual([])
    } finally { c.saves.dispose() }
  })

  it.each(['points', 'duplicate-item', 'wrong-role', 'invalid-rank', 'invalid-rng'] as const)('S06 invalid identity %s rejects import before replacing any state', async kind => {
    const { envelope } = saveFixture(); const bad = structuredClone(envelope)
    if (kind === 'points') bad.character.points++
    if (kind === 'duplicate-item') bad.character.inventory.push(1)
    if (kind === 'wrong-role') bad.character.items[0]!.role = 'boots'
    if (kind === 'invalid-rank') bad.character.rank = 22
    if (kind === 'invalid-rng') bad.lootRng = [0, 0, 0, 0]
    const c = controller(canonical(envelope)); const before = serialize(c.current())
    try {
      expect(await outcome(() => c.saves.import(canonical(bad)))).toMatchObject({ ok: false, reason: 'invalid-character' })
      expect(serialize(c.current())).toBe(before); expect(c.store.bytes()).toBe(canonical(envelope)); expect(c.store.mutations).toEqual([])
    } finally { c.saves.dispose() }
  })

  it.each(['ASCII', 'UTF-8'] as const)('S07 entire-envelope %s size limit permits boundary and rejects first representable excess', async encoding => {
    const { envelope } = saveFixture(); const prior = canonical(envelope); envelope.build = ''
    const base = canonical(envelope); const symbol = encoding === 'ASCII' ? 'a' : '界'
    const utf8 = new TextEncoder().encode(base).length; const utf16 = base.length * 2
    const count = Math.floor(Math.min((SAVE_MAX_BYTES - utf8) / new TextEncoder().encode(symbol).length, (SAVE_MAX_BYTES - utf16) / (symbol.length * 2)))
    const allowed = canonical({ ...envelope, build: symbol.repeat(count) })
    const excess = canonical({ ...envelope, build: symbol.repeat(count + 1) })
    const c = controller(prior)
    try {
      expect(new TextEncoder().encode(allowed).length).toBeLessThanOrEqual(SAVE_MAX_BYTES); expect(allowed.length * 2).toBeLessThanOrEqual(SAVE_MAX_BYTES)
      expect((await outcome(() => c.saves.import(allowed))).ok).toBe(true)
      const before = serialize(c.current())
      expect(await outcome(() => c.saves.import(excess))).toMatchObject({ ok: false, reason: 'oversize' })
      expect(serialize(c.current())).toBe(before); expect(c.store.bytes()).toBe(prior)
    } finally { c.saves.dispose() }
  })

  it.each([['security', 'security'], ['read', 'read-failed']] as const)('S08 %s read failure returns typed status and copyable text', async (fault, reason) => {
    const c = controller('prior bytes', fault)
    try {
      expect(await outcome(() => c.saves.load())).toMatchObject({ ok: false, reason })
      expect(c.saves.status().writable).toBe(false)
      expect(typeof succeeds('failure export', () => c.saves.export())).toBe('string')
      expect(c.store.bytes()).toBe('prior bytes'); expect(c.store.mutations).toEqual([])
    } finally { c.saves.dispose() }
  })

  it('S10 quota failure under real Node Web Locks preserves previous bytes and offers valid export', async () => {
    const { envelope } = saveFixture(); const initial = canonical(envelope); const c = controller(initial, 'quota', nativeLocks)
    try {
      expect((await outcome(() => c.saves.load())).ok).toBe(true)
      expect(await outcome(() => c.saves.flush())).toMatchObject({ ok: false, reason: 'quota' })
      expect(c.store.bytes()).toBe(initial)
      expect(JSON.parse(succeeds('quota export', () => c.saves.export()))).toMatchObject({ format: SAVE_FORMAT, schema: 1 })
    } finally { c.saves.dispose() }
  })

  it.each([null, 'existing'])('S09 no Web Locks, save=%s: zero writes across load/flush/import/reset/migration; text round trip works', async existing => {
    const { envelope } = saveFixture(); const initial = existing ? canonical(envelope) : null; const c = controller(initial)
    try {
      expect((await outcome(() => c.saves.load())).ok).toBe(true)
      expect(c.saves.status()).toMatchObject({ code: 'read-only', writable: false })
      const text = succeeds('read-only export', () => c.saves.export())
      expect((await outcome(() => c.saves.import(text))).ok).toBe(true)
      await outcome(() => c.saves.flush()); await outcome(() => c.saves.reset())
      expect(c.store.bytes()).toBe(initial); expect(c.store.mutations).toEqual([])
    } finally { c.saves.dispose() }
  })
})
