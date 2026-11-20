// @vitest-environment jsdom
import { locks } from 'node:worker_threads'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { Button, exportCharacter, IDLE_COMMAND } from '../../sim/core'
import { buildM3Clearing } from '../../sim/m3-clearing'
import type { createHUD } from '../../ui/hud'
import { storeSession } from '../session'
import { encodeSave } from './envelope'
import { COMMIT_LOCK, SAVE_KEY } from './index'

const initRenderer = vi.fn()
let controls: Parameters<typeof createHUD>[0]
vi.mock('three/webgpu', () => ({ WebGPURenderer: class { backend = {}; init = initRenderer } }))
vi.mock('../../render/basic/view', () => ({ BasicView: class {} }))
vi.mock('../../render/meadow-view', () => ({ MeadowView: class {
  static create() { return new this() }
  camera = { set() {}, register() {} }
  advance() {}
  resize() {}
} }))
vi.mock('../../ui/hud', () => ({ createHUD(value: typeof controls) { controls = value; return {} } }))

async function drainCommit() {
  await Promise.resolve()
  await locks.request(COMMIT_LOCK, () => {})
}

beforeEach(() => {
  vi.resetModules()
  vi.stubGlobal('__BUILD_ID__', 'save-test')
  vi.stubGlobal('requestAnimationFrame', vi.fn())
  vi.stubGlobal('navigator', { locks })
  document.body.innerHTML = '<canvas id="stage"></canvas>'
})
afterEach(() => {
  controls?.saves.dispose()
  controls?.input.dispose()
  localStorage.clear()
  sessionStorage.clear()
  initRenderer.mockReset()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function recoveryFixture() {
  const world = buildM3Clearing(7)
  localStorage.setItem(SAVE_KEY, encodeSave(exportCharacter(world), 'test', 4))
  const player = world.entities.find(e => e.id === world.playerId)!
  const item = { ...structuredClone(player.character!.items[0]!), id: world.nextItemId++ }
  return { world, player, item }
}

it('restores the newer item when renderer startup spans the autosave interval', async () => {
  const { world, player, item } = recoveryFixture()
  player.character!.items.push(item)
  player.character!.inventory.push(item.id)
  storeSession(new URL(location.href), world, false, true, { generation: 4, code: 'ready', playerEntry: true })
  const intervals = vi.spyOn(window, 'setInterval')
  initRenderer.mockImplementation(async () => {
    for (const [callback, delay] of intervals.mock.calls) {
      if (typeof callback === 'function' && delay === 30_000) callback()
    }
    await drainCommit()
  })
  await import('../../main')
  expect(JSON.parse(controls.saves.export()).character.inventory).toContain(item.id)
  expect(controls.saves.status().generation).toBe(4)
  expect(intervals.mock.calls.some(([, delay]) => delay === 30_000)).toBe(true)
})

it('commits an interaction-key pickup on pagehide', async () => {
  const { world, player, item } = recoveryFixture()
  world.groundDrops.push({ item, pos: { ...player.pos } })
  storeSession(new URL(location.href), world, false, true, { generation: 4, code: 'ready', playerEntry: true })
  await import('../../main')
  controls.clock.advance(1, { ...IDLE_COMMAND, buttons: Button.Interact })
  expect(JSON.parse(controls.saves.export()).character.inventory).toContain(item.id)
  window.dispatchEvent(new Event('pagehide'))
  await drainCommit()
  expect(JSON.parse(localStorage.getItem(SAVE_KEY)!).character.inventory).toContain(item.id)
})

it('flushes on transition to a hidden document', async () => {
  await import('../../main')
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
  document.dispatchEvent(new Event('visibilitychange'))
  await drainCommit()
  expect(localStorage.getItem(SAVE_KEY)).not.toBeNull()
})
