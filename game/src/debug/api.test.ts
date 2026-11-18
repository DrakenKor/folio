// @vitest-environment jsdom
import { Blob } from 'node:buffer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Button, createWorld, IDLE_COMMAND, previewBuild, serialize, spawnEntity, step, verifyReplay } from '../sim/core/index'
import type { Loadout, Operation } from '../sim/core/index'
import { decode, encode } from '../platform/encoding'
import { Clock } from '../platform/clock'
import { Input } from '../platform/input'
import { buildScenario } from '../sim/scenarios'
import type { CameraRig } from '../render/basic/camera'
import { createAPI } from './api'

let input: Input
beforeEach(() => {
  vi.stubGlobal('__BUILD_ID__', 'test-debug')
  // jsdom's Blob does not implement the stream API used by replay compression.
  vi.stubGlobal('Blob', Blob)
})
afterEach(() => { input?.dispose(); document.body.replaceChildren(); vi.unstubAllGlobals() })

function setup(onDebugWorld = () => {}) {
  const world = createWorld(7)
  const player = spawnEntity(world, { kind: 'player', pos: { x: 0, z: 0 }, radius: 0.4 })
  const canvas = document.createElement('canvas')
  document.body.append(canvas)
  input = new Input(canvas, () => ({ forward: { x: 0, z: -1 }, right: { x: 1, z: 0 } }), () => ({ x: 2, z: 3 }))
  const clock = new Clock(world, world => input.command(world), world => input.afterStep(world))
  const camera = { set() {}, bookmark() {}, follow() {}, register() {} } as unknown as CameraRig
  const api = createAPI(clock, input, camera, Promise.resolve(), () => {}, undefined, onDebugWorld)
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

  it('restarts a recovered defeat from its scenario and seed', () => {
    const { api, clock } = setup()
    api.scenario('m1-arena', 19)
    const start = api.snapshot()
    api.step(900)
    expect(api.observe().actors.find(actor => actor.id === clock.world.playerId)?.health).toBe(0)
    const camera = { set() {}, bookmark() {}, follow() {}, register() {} } as unknown as CameraRig
    const recovered = createAPI(clock, input, camera, Promise.resolve(), () => {})
    recovered.restart()
    expect(recovered.snapshot()).toBe(start)
    expect(clock.world).toEqual(buildScenario('m1-arena', 19))
    expect(recovered.observe().command).toBeNull()
    expect(clock.recorder.exportReplay().commands).toEqual([])
  })
})

describe('debug build controls', () => {
  it('returns simulation decisions, releases input and records exactly one idle tick per edit', () => {
    const { api, clock, canvas } = setup()
    api.scenario('m2-clearing', 7)
    expect(api.build).toBe('test-debug')
    const slots: Loadout = [null, 'fold-dart', 'rill-fan', 'plinth-blow', 'hearth-shard', 'skim-needle']
    const expectedSlots = [...slots]
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }))
    canvas.dispatchEvent(new MouseEvent('pointerdown', { button: 0 }))
    api.cmd({ ...IDLE_COMMAND, buttons: Button.Secondary })
    expect(api.character.setLoadout(slots)).toEqual({ accepted: true, reason: 'ok' })
    slots[1] = null
    expect(api.character.setFolds('fold-dart', ['missing-fold'])).toEqual({ accepted: false, reason: 'unknown-fold' })
    const commands = clock.recorder.exportReplay().commands
    expect(commands).toEqual([
      { ...IDLE_COMMAND, operations: [{ type: 'setLoadout', slots: expectedSlots }] },
      { ...IDLE_COMMAND, operations: [{ type: 'setFolds', skillId: 'fold-dart', foldIds: ['missing-fold'] }] }
    ])
    expect(api.observe()).toMatchObject({ tick: 2, paused: true })
    expect(verifyReplay(clock.recorder.exportReplay())).toEqual({ ok: true })
    api.step()
    expect(api.observe().command).toEqual(IDLE_COMMAND)
  })

  it('submits each progression operation with its public payload and reports its result', () => {
    const { api, clock } = setup()
    api.scenario('m2-clearing', 7)
    const operations: Array<[Operation, () => ReturnType<typeof api.character.allocate>]> = [
      [{ type: 'allocate', nodeId: '1,0' }, () => api.character.allocate('1,0')],
      [{ type: 'refund', nodeId: '1,0' }, () => api.character.refund('1,0')],
      [{ type: 'activateShape', shapeId: 'rhombus-0', active: false }, () => api.character.activateShape('rhombus-0', false)],
      [{ type: 'equip', itemId: 1 }, () => api.character.equip(1)],
      [{ type: 'unequip', role: 'weapon' }, () => api.character.unequip('weapon')],
      [{ type: 'pickup', itemId: 99 }, () => api.character.pickup(99)],
      [{ type: 'stash', itemId: 99, from: 'inventory' }, () => api.character.stash(99, 'inventory')],
      [{ type: 'discard', itemId: 99, from: 'stash' }, () => api.character.discard(99, 'stash')],
      [{ type: 'beginEncounter' }, () => api.character.beginEncounter()],
      [{ type: 'returnToShelter' }, () => api.character.returnToShelter()]
    ]
    for (const [operation, call] of operations) {
      const expected = structuredClone(clock.world)
      const command = { ...IDLE_COMMAND, operations: [operation] }
      const event = step(expected, command).find(event => event.type === 'operationAccepted' || event.type === 'operationRejected')!
      expect(call()).toEqual({ accepted: event.type === 'operationAccepted', reason: event.reason })
      expect(api.snapshot()).toBe(serialize(expected))
      expect(api.observe().command).toEqual(command)
    }
  })

  it('observes the resolved M2 recipe and keeps query results detached', () => {
    const { api, clock } = setup()
    api.scenario('m2-clearing', 7)
    const allocate = { type: 'allocate', nodeId: '1,0' } as const
    const beforePreview = api.snapshot()
    expect(api.character.preview(allocate)).toEqual(previewBuild(clock.world, allocate))
    expect(api.snapshot()).toBe(beforePreview)
    expect(api.character.setFolds('rill-fan', ['ballast-pleat'])).toEqual({ accepted: true, reason: 'ok' })
    const fixture = structuredClone(clock.world)
    fixture.encounter = null
    spawnEntity(fixture, { kind: 'target', faction: 'enemy', pos: { x: 1, z: 1 }, radius: 0.4 })
    api.restore(serialize(fixture))
    const targetId = fixture.entities.at(-1)!.id
    const before = api.snapshot()
    const stats = api.stats()
    const action = api.damage('rill-fan', targetId)
    expect(stats).toMatchObject({ ok: true, value: { actorId: fixture.playerId } })
    expect(action).toMatchObject({ ok: true, value: { recipe: { folds: ['ballast-pleat'], timing: { windupTicks: 16 } } } })
    if (stats.ok) stats.value.sources.length = 0
    if (action.ok) action.value.recipe.timing.windupTicks = 0
    expect(api.stats()).not.toEqual(stats)
    expect(api.damage('rill-fan', targetId)).not.toEqual(action)
    expect(api.snapshot()).toBe(before)
    api.cmd({ ...IDLE_COMMAND, buttons: Button.Skill1 })
    api.step(13)
    expect(api.observe().actors[0]!.action).toMatchObject({ id: 'rill-fan', ageTicks: 12, phase: 'windup' })
  })
})

it('rejects a divergent replay before replacing the live world or changing session ownership', async () => {
  const replaced = vi.fn()
  const { api } = setup(replaced)
  const replay = JSON.parse(await decode(await api.exportReplay()))
  replay.hashes[0][1] = 'bad'
  api.step(5)
  const before = api.hash()
  expect(await api.loadReplay(await encode(JSON.stringify(replay)))).toEqual({ ok: false, divergedAt: 0 })
  expect(api.hash()).toBe(before)
  expect(replaced).not.toHaveBeenCalled()
})

it('replays a westward dodge with signed-zero coordinates after text export', async () => {
  const { api } = setup()
  api.cmd({ move: { x: -1, z: -0 }, aim: { x: -1, z: -0 }, buttons: Button.Dodge })
  api.step(2)
  expect(await api.loadReplay(await api.exportReplay())).toEqual({ ok: true })
})

it('exposes the commit barrier through the static debug API', () => {
  vi.stubEnv('DEV', false)
  try {
    const { api } = setup()
    expect(api.save.commitBarrier('arm')).toBe(false)
    expect(api.save.commitBarrier('release')).toBe(false)
  } finally { vi.unstubAllEnvs() }
})
