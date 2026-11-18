import { actionPhase, canonical, copyCommand, exportCharacter, hashWorld, IDLE_COMMAND, inspectStats, loadCharacter, previewAction, previewBuild, restore, serialize, validateOperation, verifyReplay } from '../sim/core/index'
import type { Command, EquipmentRole, ItemId, ItemStore, Loadout, Operation, OperationResult, Replay } from '../sim/core/index'
import { buildScenario } from '../sim/scenarios'
import type { CameraRig } from '../render/basic/camera'
import type { Clock } from '../platform/clock'
import type { Input } from '../platform/input'
import { decode, encode } from '../platform/encoding'
import { SaveController } from '../platform/saves'

export interface ScriptEntry { tick: number; command: Command }

export function createAPI(clock: Clock, input: Input, camera: CameraRig, ready: Promise<void>, loseDevice: () => void, saves?: SaveController) {
  const replace = (text: string) => {
    const world = restore(text)
    input.release()
    clock.replace(world)
  }
  const save = saves ?? new SaveController({ build: __BUILD_ID__, content: clock.world.content,
    getWorld: () => clock.world, replaceWorld: world => replace(serialize(world)), exportCharacter, loadCharacter })
  const edit = (operation: Operation): OperationResult => {
    validateOperation(operation)
    input.release()
    clock.advance(1, { ...IDLE_COMMAND, operations: [structuredClone(operation)] })
    return { accepted: false, reason: 'unsupported' }
  }
  return {
    ready,
    character: {
      allocate: (nodeId: string) => edit({ type: 'allocate', nodeId }),
      refund: (nodeId: string) => edit({ type: 'refund', nodeId }),
      activateShape: (shapeId: string, active = true) => edit({ type: 'activateShape', shapeId, active }),
      equip: (itemId: ItemId) => edit({ type: 'equip', itemId }),
      unequip: (role: EquipmentRole) => edit({ type: 'unequip', role }),
      setLoadout: (slots: Loadout) => edit({ type: 'setLoadout', slots }),
      setFolds: (skillId: string, foldIds: string[]) => edit({ type: 'setFolds', skillId, foldIds }),
      pickup: (itemId: ItemId) => edit({ type: 'pickup', itemId }),
      stash: (itemId: ItemId, from: ItemStore) => edit({ type: 'stash', itemId, from }),
      discard: (itemId: ItemId, from: ItemStore) => edit({ type: 'discard', itemId, from }),
      beginEncounter: () => edit({ type: 'beginEncounter' }),
      returnToShelter: () => edit({ type: 'returnToShelter' }),
      preview: (operation: Operation) => previewBuild(clock.world, operation)
    },
    stats: (actorId = clock.world.playerId!) => inspectStats(clock.world, actorId),
    damage: (skillId: string, targetId: number, actorId = clock.world.playerId!) => previewAction(clock.world, actorId, skillId, targetId),
    save: { status: () => save.status(), export: () => save.export(), import: (text: string) => save.import(text),
      flush: () => save.flush(), load: () => save.load() },
    describe(): string {
      const world = clock.world
      const player = world.entities.find(entity => entity.id === world.playerId)
      const lines = [`Tick ${world.tick}; ${clock.paused ? 'paused' : 'running'}`]
      if (!player) return `${lines[0]}; no player`
      lines.push(`Player (${player.pos.x.toFixed(2)}, ${player.pos.z.toFixed(2)}), facing ${player.facing.toFixed(3)} rad`)
      const nearby = world.entities.filter(entity => entity.id !== player.id).map(entity => ({ entity,
        distance: Math.hypot(entity.pos.x - player.pos.x, entity.pos.z - player.pos.z),
        bearing: Math.atan2(entity.pos.z - player.pos.z, entity.pos.x - player.pos.x) }))
      nearby.sort((a, b) => a.distance - b.distance || a.entity.id - b.entity.id)
      for (const { entity, distance, bearing } of nearby.slice(0, 8)) {
        lines.push(`${entity.id} ${entity.kind}: ${distance.toFixed(2)} m, bearing ${bearing.toFixed(3)} rad`)
      }
      return lines.join('\n')
    },
    state(path?: string): unknown {
      let value: unknown = JSON.parse(serialize(clock.world)).world
      for (const key of path ? path.split('.') : []) {
        if (value === null || typeof value !== 'object' || !Object.hasOwn(value, key)) return undefined
        value = (value as Record<string, unknown>)[key]
      }
      return value
    },
    observe() {
      const world = clock.world
      const command = clock.recorder.exportReplay().commands.at(-1) ?? null
      return structuredClone({ tick: world.tick, hash: hashWorld(world), paused: clock.paused,
        playerId: world.playerId, commandTick: command ? world.tick : null, command,
        actors: world.entities.map(actor => {
          const action = actor.action
          const timing = action?.kind === 'dodge' ? world.content.dodge.timing :
            world.content.skills.find(skill => skill.id === action?.id)?.timing
          return { ...actor, action: action ? { ...action, phase: actionPhase(timing!, action.ageTicks) } : null }
        }), projectiles: world.projectiles })
    },
    cmd: (command: Command) => input.queue(command),
    hash: () => hashWorld(clock.world),
    perf: () => clock.perf(),
    pause: () => clock.pause(),
    resume: () => clock.resume(),
    step: (ticks = 1) => clock.advance(ticks),
    snapshot: () => serialize(clock.world),
    async link(): Promise<string> {
      const url = new URL(location.href)
      url.hash = `snap=${await encode(serialize(clock.world))}`
      return url.href
    },
    restore: replace,
    scenario(name: string, seed = 1): void {
      const snapshot = serialize(buildScenario(name, seed))
      replace(snapshot)
    },
    restart(): void { replace(serialize(buildScenario(clock.world.scenario, clock.world.seed))) },
    simulate(script: ScriptEntry[], ticks: number): string {
      if (!Array.isArray(script)) throw new TypeError('Script must be an array')
      if (!Number.isSafeInteger(ticks) || ticks < 0) throw new RangeError('Ticks must be a nonnegative safe integer')
      let previous = -1
      const entries = script.map(entry => {
        if (!entry || !Number.isSafeInteger(entry.tick) || entry.tick <= previous) throw new TypeError('Script ticks must be nonnegative and strictly increasing')
        previous = entry.tick
        return { tick: entry.tick, command: copyCommand(entry.command) }
      })
      let index = 0
      let command: Command = IDLE_COMMAND
      for (let i = 0; i < ticks; i++) {
        while (entries[index] && entries[index]!.tick <= clock.world.tick) command = entries[index++]!.command
        clock.advance(1, input.command(clock.world, command))
      }
      return hashWorld(clock.world)
    },
    exportReplay: () => encode(canonical({ ...clock.recorder.exportReplay(), build: __BUILD_ID__ })),
    async loadReplay(text: string) {
      const replay: Replay = JSON.parse(await decode(text))
      const result = verifyReplay(replay)
      // Check replay hashes before replacing live state.
      replace(JSON.stringify(replay.start))
      clock.pause()
      for (const command of replay.commands) clock.advance(1, command)
      return result
    },
    agent: { moveTo: (x: number, z: number) => input.moveTo(x, z) },
    teleport(x: number, z: number): void {
      if (!Number.isFinite(x) || !Number.isFinite(z)) throw new TypeError('Coordinates must be finite')
      const world = restore(serialize(clock.world))
      const player = world.entities.find(entity => entity.id === world.playerId)
      if (!player) throw new Error('No player to teleport')
      player.pos = { x, z }
      player.vel = { x: 0, z: 0 }
      player.knockback = null
      player.gait.speed = 0
      replace(serialize(world))
    },
    camera: { bookmark: (name: string) => camera.bookmark(name), set: camera.set.bind(camera),
      follow: () => camera.follow(), register: camera.register.bind(camera) },
    debug: { loseDevice },
    get backend() { return document.body.dataset.backend },
    build: __BUILD_ID__
  }
}

declare const __BUILD_ID__: string
declare global {
  interface Window { __game?: ReturnType<typeof createAPI> }
}
