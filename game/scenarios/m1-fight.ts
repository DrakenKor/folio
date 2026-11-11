import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { fightCommand } from '../src/sim/ai/fight-script'
import { stepEncounter } from '../src/sim/ai/step'
import { copyCommand, Recorder } from '../src/sim/core/commands'
import { hashWorld } from '../src/sim/core/hash'
import { restore, serialize } from '../src/sim/core/snapshot'
import { IDLE_COMMAND } from '../src/sim/core/types'
import type { Command, Replay, SimEvent, SnapshotEnvelope } from '../src/sim/core/types'
import { buildScenario } from '../src/sim/scenarios'

export interface ScriptEntry { tick: number; command: Command }

/** Run the entire encounter with commands only, retaining its complete replay and recorder window. */
export function runFight(entries?: ScriptEntry[]) {
  const world = buildScenario('m1-fight', 7)
  const start = JSON.parse(serialize(world)) as SnapshotEnvelope
  const recorder = new Recorder(world)
  const replay: Replay = { format: 'folio.arpg.replay', start, commands: [], hashes: [[0, hashWorld(world)]] }
  const script: ScriptEntry[] = []
  const events: SimEvent[] = []
  let command: Command = IDLE_COMMAND
  let index = 0
  let incomingKnockback = false
  let enemyKnockback = false
  let impactPause = false
  while (world.tick < 7200) {
    if (entries) {
      if (entries[index]?.tick === world.tick) command = copyCommand(entries[index++]!.command)
    } else command = copyCommand(fightCommand(world))
    if (script.length === 0 || JSON.stringify(script.at(-1)!.command) !== JSON.stringify(command)) {
      script.push({ tick: world.tick, command: copyCommand(command) })
    }
    events.push(...stepEncounter(world, command, 'm1-fight'))
    recorder.record(command)
    replay.commands.push(copyCommand(command))
    if (world.tick % 60 === 0) replay.hashes.push([world.tick, hashWorld(world)])
    incomingKnockback ||= world.entities.some(actor => actor.id === world.playerId && actor.knockback !== null)
    enemyKnockback ||= world.entities.some(actor => actor.ai && actor.knockback !== null)
    impactPause ||= world.entities.some(actor => actor.impactPauseTicks > 0)
  }
  const damage = events.filter(event => event.type === 'damage')
  const player = world.entities.find(actor => actor.id === world.playerId)!
  const report = {
    scenario: 'm1-fight', seed: 7, ticks: world.tick, driver: 'stepEncounter',
    damageEvents: damage.length,
    outgoingDamage: damage.filter(event => event.actorId === player.id).reduce((sum, event) => sum + event.amount, 0),
    incomingDamage: damage.filter(event => event.targetId === player.id).reduce((sum, event) => sum + event.amount, 0),
    enemyDeaths: events.filter(event => event.type === 'death' && event.targetId !== player.id).length,
    playerDeaths: events.filter(event => event.type === 'death' && event.targetId === player.id).length,
    dodges: events.filter(event => event.type === 'dodge').length,
    spanCutHits: damage.filter(event => event.skillId === 'span-cut').length,
    foldDartHits: damage.filter(event => event.skillId === 'fold-dart').length,
    playerHealth: player.health, incomingKnockback, enemyKnockback, impactPause,
    hashes: replay.hashes.length, finalHash: hashWorld(world), nextId: world.nextId
  }
  return { world, report, replay, script, events, retained: recorder.exportReplay() }
}

/** Verify with the content adapter; core verifyReplay awaits the documented integration hook. */
export function verifyFight(replay: Replay): { ok: boolean; divergedAt?: number } {
  const world = restore(JSON.stringify(replay.start))
  const hashes = new Map(replay.hashes)
  if (hashes.get(world.tick) !== hashWorld(world)) return { ok: false, divergedAt: world.tick }
  for (const command of replay.commands) {
    stepEncounter(world, command, 'm1-fight')
    if (hashes.has(world.tick) && hashes.get(world.tick) !== hashWorld(world)) return { ok: false, divergedAt: world.tick }
  }
  return { ok: true }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const recording = process.argv.includes('--record')
  const commandsUrl = new URL('./m1-fight-commands.json', import.meta.url)
  const expectedUrl = new URL('./m1-fight.json', import.meta.url)
  const fight = runFight(recording ? undefined : JSON.parse(readFileSync(commandsUrl, 'utf8')))
  const verified = verifyFight(fight.replay)
  if (!verified.ok) throw new Error(`Fight replay diverged at ${verified.divergedAt}`)
  if (recording) {
    writeFileSync(commandsUrl, '[\n' + fight.script.map(entry => `  ${JSON.stringify(entry)}`).join(',\n') + '\n]\n')
    writeFileSync(expectedUrl, JSON.stringify({ ...fight.report, replayVerified: true, checkpoints: fight.replay.hashes }, null, 2) + '\n')
  } else {
    const expected = JSON.parse(readFileSync(expectedUrl, 'utf8'))
    if (JSON.stringify(expected.checkpoints) !== JSON.stringify(fight.replay.hashes)) throw new Error('Committed fight hashes changed')
  }
  process.stdout.write(JSON.stringify({ ...fight.report, replayVerified: true }) + '\n')
}
