// @vitest-environment jsdom
import { Blob } from 'node:buffer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Button, createWorld, IDLE_COMMAND, serialize, spawnEntity, verifyReplay } from '../sim/core/index'
import { Clock } from '../platform/clock'
import { Input } from '../platform/input'
import type { CameraRig } from '../render/basic/camera'
import { createAPI } from './api'

let input: Input
beforeEach(() => {
  vi.stubGlobal('__BUILD_ID__', 'test-debug')
  // jsdom's Blob does not implement the stream API used by replay compression.
  vi.stubGlobal('Blob', Blob)
})
afterEach(() => { input?.dispose(); document.body.replaceChildren(); vi.unstubAllGlobals() })

function setup() {
  const world = createWorld(7)
  const player = spawnEntity(world, { kind: 'player', pos: { x: 0, z: 0 }, radius: 0.4 })
  const canvas = document.createElement('canvas')
  document.body.append(canvas)
  input = new Input(canvas, () => ({ forward: { x: 0, z: -1 }, right: { x: 1, z: 0 } }), () => ({ x: 2, z: 3 }))
  const clock = new Clock(world, world => input.command(world), world => input.afterStep(world))
  const camera = { set() {}, bookmark() {}, follow() {}, register() {} } as unknown as CameraRig
  const api = createAPI(clock, input, camera, Promise.resolve(), () => {})
  clock.pause()
  return { api, clock, world, player, canvas }
}

describe('debug command boundary', () => {
  it('records queued, live and simulate commands consistently and verifies their replay', async () => {
    const { api, clock } = setup()
    const start = api.snapshot()
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }))
    const queued = { move: { x: 1, z: 0 }, aim: { x: 2, z: 1 }, buttons: Button.Primary }
    api.cmd(queued)
    expect(api.observe().command).toBeNull()
    api.step()
    expect(api.observe()).toMatchObject({ tick: 1, commandTick: 1, command: queued })
    api.step()
    const manual = api.hash()
    const stream = clock.recorder.exportReplay().commands
    expect(stream[1]?.move).toEqual({ x: 0, z: -1 })
    expect(verifyReplay(clock.recorder.exportReplay())).toEqual({ ok: true })
    const exported = await api.exportReplay()
    api.restore(start)
    api.cmd(queued)
    api.simulate([{ tick: 0, command: stream[1]! }], 2)
    expect(api.hash()).toBe(manual)
    expect(clock.recorder.exportReplay().commands).toEqual(stream)
    await expect(api.loadReplay(exported)).resolves.toEqual({ ok: true })
    expect(api.hash()).toBe(manual)
  })

  it('restore clears held, pending and queued input while retaining recorded button history', () => {
    const { api, clock, player, canvas } = setup()
    player.previousButtons = Button.Dodge
    const snapshot = api.snapshot()
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }))
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }))
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }))
    canvas.dispatchEvent(new MouseEvent('pointerdown', { button: 0 }))
    api.cmd({ ...IDLE_COMMAND, buttons: Button.Secondary })
    api.restore(snapshot)
    expect(api.observe().command).toBeNull()
    expect(clock.world.entities[0]!.previousButtons).toBe(Button.Dodge)
    api.step()
    expect(api.observe().command).toEqual(IDLE_COMMAND)
  })

  it('observes detached combat state, action phases and projectiles', () => {
    const { api, world, player } = setup()
    world.tick = 20
    world.content.skills = [{ id: 'fixture', kind: 'projectile', timing: { windupTicks: 2, activeTicks: 1, recoveryTicks: 3, moveCancelTicks: 1 },
      cooldownTicks: 10, damage: 1, knockback: { speed: 0, ticks: 0 }, impactPauseTicks: 2, hitFlashTicks: 6,
      speed: 12, radius: 0.1, lifetimeTicks: 30 }]
    player.action = { id: 'fixture', kind: 'projectile', startTick: 17, ageTicks: 3, direction: 1, hitTargetIds: [], projectileSpawned: true }
    player.cooldowns.primary = 7
    player.impactPauseTicks = 2
    player.gait = { phase: 2.3, speed: 2 }
    world.projectiles = [{ id: world.nextId++, ownerId: player.id, faction: player.faction, skillId: 'fixture', actionStartTick: 17,
      pos: { x: 1, z: 0 }, vel: { x: 12, z: 0 }, radius: 0.1, ageTicks: 1, lifetimeTicks: 30,
      damage: 1, knockback: { speed: 0, ticks: 0 }, impactPauseTicks: 2, hitFlashTicks: 6 }]
    api.restore(serialize(world))
    const observation = api.observe()
    expect(observation.actors[0]).toMatchObject({ health: 1, maxHealth: 1, action: { id: 'fixture', kind: 'projectile', ageTicks: 3, phase: 'recovery' },
      cooldowns: { primary: 7 }, aim: 0, facing: 0, gait: { phase: 2.3, speed: 2 }, impactPauseTicks: 2, death: null })
    expect(observation.projectiles).toEqual(world.projectiles)
    observation.actors[0]!.cooldowns.primary = 0
    observation.projectiles[0]!.pos.x = 999
    expect(api.observe().projectiles[0]!.pos.x).toBe(1)
    expect(api.observe().actors[0]!.cooldowns.primary).toBe(7)
  })

  it('teleport clears motion and resets replay while preserving gait phase; restart restores the scenario', () => {
    const { api, clock, player } = setup()
    player.gait = { phase: 4.2, speed: 2 }
    player.knockback = { vel: { x: 3, z: 0 }, remainingTicks: 4 }
    api.teleport(10, 20)
    expect(api.observe().actors[0]).toMatchObject({ pos: { x: 10, z: 20 }, vel: { x: 0, z: 0 }, knockback: null, gait: { phase: 4.2, speed: 0 } })
    expect(clock.recorder.exportReplay().commands).toEqual([])
    api.scenario('meadow-start', 3)
    const start = api.hash()
    api.step(10)
    api.restart()
    expect(api.hash()).toBe(start)
    expect(api.observe().command).toBeNull()
  })
})
