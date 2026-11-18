import schedule from '../scenarios/m2-balance.json'
import { calculateDamage } from '../src/sim/combat/damage-model'
import { actorStats } from '../src/sim/combat/stats'
import { DAMAGE_TYPES, Recorder, hashWorld, step, verifyReplay } from '../src/sim/core'
import type { DamageValues } from '../src/sim/core'
import { buildScenario } from '../src/sim/scenarios'
import { balanceCommand, balanceFixtures, balanceWaves, fixtureGearBudget, loadBalanceCharacter, type BalanceFixture } from './m2-fixtures'

export function balanceWorld(fixture: BalanceFixture, seed: number) {
  const fresh = buildScenario('m2-clearing', seed)
  return loadBalanceCharacter(fixture, fresh.content, seed, fresh.rng.loot!)
}

export function runBalance() {
  return balanceFixtures.flatMap(fixture => fixture.seeds.map(seed => {
    const world = balanceWorld(fixture, seed)
    const player = world.entities.find(actor => actor.id === world.playerId)!
    const recorder = new Recorder(world)
    const checkpoints: [number, string][] = [[0, hashWorld(world)]]
    const byAction: Record<string, { applied: number; postDefence: DamageValues; appliedByType: DamageValues }> = {}
    let kills = 0
    const waves = balanceWaves(seed)
    const verifyWave = (index: number, positions: { x: number; z: number }[]) => {
      const expected = waves[index]!.positions
      if (positions.length !== expected.length || positions.some((pos, i) => pos.x !== expected[i]!.x || pos.z !== expected[i]!.z)) {
        throw new Error(`Frozen wave mismatch for seed ${seed} at tick ${world.tick}`)
      }
    }
    verifyWave(0, world.entities.filter(actor => actor.ai?.enemyId === 'creaseback').map(actor => actor.pos))
    for (let tick = 0; tick < schedule.ticks; tick++) {
      const actors = new Map(world.entities.map(actor => [actor.id, actor]))
      const action = player.action
      const shots = new Map(world.projectiles.map(shot => [shot.id, shot]))
      const command = balanceCommand(world, fixture)
      const events = step(world, command)
      recorder.record(command)
      if (world.tick % 60 === 0) checkpoints.push([world.tick, hashWorld(world)])
      for (const event of events) {
        if (event.type !== 'death' || event.actorId !== player.id) continue
        if (actors.get(event.targetId)?.ai?.enemyId === 'creaseback') kills++
      }
      const hits = new Map(events.flatMap(event => event.type === 'hit' && event.actorId === player.id ? [[event.targetId, event] as const] : []))
      for (const event of events) {
        if (event.type !== 'damage' || event.actorId !== player.id) continue
        let parts: DamageValues
        if (event.skillId === 'emberprint') parts = { weight: 0, heat: event.amount, gale: 0 }
        else {
          const hit = hits.get(event.targetId)
          const target = actors.get(event.targetId)
          const recipe = (hit && hit.projectileId !== null ? shots.get(hit.projectileId)?.recipe : undefined) ?? action?.recipe
          if (!target || !recipe || recipe.skillId !== event.skillId) throw new Error(`Missing captured recipe for ${event.skillId} at ${event.tick}`)
          const damage = calculateDamage(recipe, actorStats(world, target, recipe.tags).reductions, event.amount + event.health)
          if (damage.applied !== event.amount) throw new Error(`Damage attribution disagrees at tick ${event.tick}`)
          parts = damage.postDefence
        }
        const total = DAMAGE_TYPES.reduce((sum, type) => sum + parts[type], 0)
        const totals = byAction[event.skillId] ??= {
          applied: 0, postDefence: { weight: 0, heat: 0, gale: 0 }, appliedByType: { weight: 0, heat: 0, gale: 0 }
        }
        totals.applied += event.amount
        for (const type of DAMAGE_TYPES) {
          totals.postDefence[type] += parts[type]
          totals.appliedByType[type] += total === 0 ? 0 : event.amount * parts[type] / total
        }
      }
      if (world.tick % schedule.waveTicks === 0 && world.tick < schedule.ticks) {
        verifyWave(world.tick / schedule.waveTicks,
          events.flatMap(event => event.type === 'spawn' ? [world.entities.find(actor => actor.id === event.id)!.pos] : []))
      }
    }
    const healthRatio = player.health / player.maxHealth
    const replay = recorder.exportReplay()
    const replayResult = verifyReplay(replay)
    return { build: fixture.id, gear: fixtureGearBudget(fixture), seed, ticks: world.tick, kills, health: player.health,
      maxHealth: player.maxHealth, healthRatio, metGate: kills === 36 && !player.death && healthRatio >= .25,
      byAction, hash: hashWorld(world), checkpoints, replay: { ...replayResult, start: replay.start.world.tick, ticks: replay.commands.length } }
  }))
}

async function main() {
  const { mkdirSync, writeFileSync } = await import('node:fs')
  const runs = runBalance()
  const builds = balanceFixtures.map(fixture => ({ build: fixture.id, metGate: runs.filter(run => run.build === fixture.id && run.metGate).length }))
  mkdirSync('game/.play-out/m2', { recursive: true })
  writeFileSync('game/.play-out/m2/balance.json', JSON.stringify({ node: process.version, builds, runs }, null, 2) + '\n')
  console.log(JSON.stringify({ builds, runs: runs.map(({ checkpoints: _checkpoints, gear: _gear, ...run }) => run) }))
  if (builds.some(build => build.metGate < 8) || runs.some(run => !run.replay.ok)) process.exitCode = 1
}

if (typeof process !== 'undefined' && process.argv[1]?.endsWith('/m2-balance.ts')) void main()
