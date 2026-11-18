import stress from '../scenarios/m2-stress.json'
import { encodeSave, parseEnvelope, SaveError } from '../src/platform/saves/envelope'
import { applyAilments } from '../src/sim/combat/ailments'
import { resolveRecipe } from '../src/sim/combat/recipe'
import { actorStats } from '../src/sim/combat/stats'
import { canonical, EQUIPMENT_ROLES, exportCharacter, hashWorld, IDLE_COMMAND, loadCharacter, restore, SAVE_MAX_BYTES, serialize, spawnEntity, step } from '../src/sim/core'
import type { EquipmentRole, RolledItem, World } from '../src/sim/core'
import { buildScenario } from '../src/sim/scenarios'
import { balanceCharacter, balanceFixtures, fixtureGearBudget } from './m2-fixtures'

export function summarize(intervals: number[]) {
  const sorted = [...intervals].sort((a, b) => a - b)
  return { median: sorted[Math.ceil(sorted.length * .5) - 1], p95: sorted[Math.ceil(sorted.length * .95) - 1], samples: sorted.length }
}

function stressWorld() {
  const fixture = balanceFixtures.find(fixture => `m2-${fixture.id}.json` === stress.characterFixture)!
  const fresh = buildScenario('m2-clearing', stress.seed)
  const data = balanceCharacter(fixture, fresh.content, stress.seed, fresh.rng.loot!)
  data.character.folds = structuredClone(stress.folds)
  const world = loadCharacter(data, fresh.content).world
  const player = world.entities.find(actor => actor.id === world.playerId)!
  world.scenario = 'm2-stress'
  world.encounter = { id: world.scenario, phase: 'active', attempt: 1, rewardedIds: [] }
  world.arena = null
  world.entities = []
  world.playerId = null
  world.nextId = 1
  world.nextItemId = 1

  // Paired lanes keep sweep candidates local while every actor carries the full build.
  for (let index = 0; index < stress.actors; index++) {
    const character = structuredClone(player.character!)
    const offset = world.nextItemId - 1
    for (const item of character.items) item.id += offset
    for (const role of EQUIPMENT_ROLES) character.equipment[role]! += offset
    world.nextItemId += character.items.length
    const pair = Math.floor(index / 2)
    spawnEntity(world, { kind: index === 0 ? 'player' : 'stress-actor',
      faction: index % 2 === 0 ? 'a' : 'b', pos: { x: pair % 10 * 8 + index % 2 * 2, z: Math.floor(pair / 10) * 8 },
      radius: player.radius, maxHealth: player.maxHealth, health: player.health, character, skills: player.skills })
  }
  return { world: restore(serialize(world)), gear: fixtureGearBudget(fixture) }
}

function refreshAilments(world: World) {
  for (const [index, actor] of world.entities.entries()) {
    applyAilments(world, world.entities[index ^ 1]!.id, actor.id, { weight: 12, heat: 12, gale: 12 })
  }
}

export function runBench() {
  const { world, gear } = stressWorld()
  refreshAilments(world)
  const coldStart = performance.now()
  const recipes = world.entities.map(actor => {
    const stats = actorStats(world, actor)
    return world.content.m2!.actions.map(action => {
      const recipe = resolveRecipe(world, actor, action, undefined, stats)
      if (!recipe.ok || recipe.value.folds.length !== stress.foldsPerAction) throw new Error(`Invalid stress recipe ${action.id}`)
      return { action, recipe: recipe.value }
    }).filter(result => result.action.kind === 'projectile')
  })
  const coldCacheRebuildMs = performance.now() - coldStart
  let serial = 0
  function refill() {
    while (world.projectiles.length < stress.liveProjectiles) {
      const sourceIndex = serial * 73 % world.entities.length
      const source = world.entities[sourceIndex]!, target = world.entities[sourceIndex ^ 1]!
      const cards = recipes[sourceIndex]!
      const { action, recipe } = cards[Math.floor(serial / world.entities.length) % cards.length]!
      const direction = sourceIndex % 2 === 0 ? 1 : -1
      const { speed, lifetimeTicks, radius } = recipe.footprint
      const distance = .4 + (serial * 13 % 23) * speed / 60
      world.projectiles.push({ id: world.nextId++, ownerId: source.id, faction: source.faction, skillId: action.id, recipe,
        pos: { x: target.pos.x - direction * distance, z: target.pos.z }, vel: { x: direction * speed, z: 0 },
        ageTicks: 0, lifetimeTicks, radius, actionStartTick: world.tick, damage: action.damage, knockback: action.knockback,
        impactPauseTicks: action.impactPauseTicks, hitFlashTicks: action.hitFlashTicks })
      serial++
    }
  }

  const intervals: number[] = []
  let contacts = 0, pulseEvaluations = 0, damageEvents = 0, actorPeak = 0, projectilePeak = 0, postTickProjectileMin = Infinity
  let coldTickMs = 0
  for (let tick = 0; tick < stress.warmupTicks + stress.samples; tick++) {
    if (tick && tick % 60 === 0) refreshAilments(world)
    // Sustain the benchmark population outside the measured simulation tick.
    for (const actor of world.entities) {
      if (actor.death) throw new Error(`Stress actor ${actor.id} died`)
      actor.health = actor.maxHealth
    }
    refill()
    if (world.entities.length !== stress.actors || world.projectiles.length !== stress.liveProjectiles ||
      world.ailments.length !== stress.actors * stress.ailments.length) throw new Error('Stress load dropped below the fixture')
    const start = performance.now()
    const events = step(world, IDLE_COMMAND)
    const elapsed = performance.now() - start
    if (tick === 0) coldTickMs = elapsed
    if (tick < stress.warmupTicks) continue
    intervals.push(elapsed)
    actorPeak = Math.max(actorPeak, world.entities.length)
    projectilePeak = Math.max(projectilePeak, stress.liveProjectiles, world.projectiles.length)
    postTickProjectileMin = Math.min(postTickProjectileMin, world.projectiles.length)
    for (const event of events) {
      if (event.type === 'hit') contacts++
      if (event.type === 'damage') {
        damageEvents++
        if (event.skillId === 'emberprint') pulseEvaluations++
      }
    }
  }

  const dummies = buildScenario('dummies-1000', stress.seed)
  for (let tick = 0; tick < stress.warmupTicks; tick++) step(dummies, IDLE_COMMAND)
  const dummyIntervals = Array.from({ length: stress.samples }, () => {
    const start = performance.now()
    step(dummies, IDLE_COMMAND)
    return performance.now() - start
  })
  return { seed: stress.seed, warmupTicks: stress.warmupTicks,
    stress: { scenario: world.scenario, gear, actorPeak, projectilePeak, projectilesAtTickStart: stress.liveProjectiles,
      postTickProjectileMin, ailmentsPerActor: stress.ailments.length, contacts, pulseEvaluations, damageEvents,
      damageEvaluations: contacts + pulseEvaluations, coldCacheRebuildMs, coldTickMs, hash: hashWorld(world), ...summarize(intervals), intervals },
    dummies: { actors: dummies.entities.filter(actor => actor.kind === 'dummy').length,
      hash: hashWorld(dummies), ...summarize(dummyIntervals), intervals: dummyIntervals } }
}

function measureSave(build: string) {
  const initial = buildScenario('m2-clearing', Number.MIN_SAFE_INTEGER)
  const content = initial.content.m2!
  const data = balanceCharacter(balanceFixtures[0], initial.content, initial.seed, initial.rng.loot!)
  data.character.folds = structuredClone(stress.folds)
  const largest = <T>(values: T[]): T => values.reduce((best, value) => canonical(value).length > canonical(best).length ? value : best)
  const candidates = EQUIPMENT_ROLES.map(role => {
    const base = largest(content.itemBases.filter(base => base.role === role).map(base => base.id))
    return { id: 1, baseId: base, role, affixes: (['offensive', 'utility'] as const).flatMap(category => {
      const options = content.affixes.filter(family => family.category === category && family.roles.includes(role))
        .flatMap(family => family.tiers.map(tier => ({ familyId: family.id, category, tier: tier.tier, roll: tier.max })))
      return options.length ? [largest(options)] : []
    }) }
  })
  const add = (item: RolledItem, index: number) => ({ ...structuredClone(item), id: Number.MAX_SAFE_INTEGER - 65 + index })
  data.character.items = [...candidates, ...Array.from({ length: 60 }, () => largest(candidates))].map(add)
  data.character.equipment = Object.fromEntries(data.character.items.slice(0, 5).map(item => [item.role, item.id])) as Record<EquipmentRole, number>
  data.character.inventory = data.character.items.slice(5, 35).map(item => item.id)
  data.character.stash = data.character.items.slice(35).map(item => item.id)
  data.nextItemId = Number.MAX_SAFE_INTEGER
  const current = loadCharacter(data, initial.content).world
  const bytes = (text: string) => ({ utf8: new TextEncoder().encode(text).length, utf16: text.length * 2 })
  const text = encodeSave(exportCharacter(current), build, Number.MAX_SAFE_INTEGER)
  const envelope = { ...parseEnvelope(text), build: '' }
  const size = bytes(canonical(envelope))
  const boundaries = ['a', '界'].map(symbol => {
    const unit = bytes(symbol)
    const count = Math.floor(Math.min((SAVE_MAX_BYTES - size.utf8) / unit.utf8, (SAVE_MAX_BYTES - size.utf16) / unit.utf16))
    const allowed = canonical({ ...envelope, build: symbol.repeat(count) })
    const excess = canonical({ ...envelope, build: symbol.repeat(count + 1) })
    const accepted = parseEnvelope(allowed).build === symbol.repeat(count)
    let rejected = false
    try { parseEnvelope(excess) }
    catch (error) { if (!(error instanceof SaveError && error.code === 'oversize')) throw error; rejected = true }
    return { encoding: symbol === 'a' ? 'UTF-16 storage' : 'UTF-8', allowed: bytes(allowed), excess: bytes(excess), accepted, rejected }
  })
  return { items: data.character.items.length, affixes: data.character.items.reduce((sum, item) => sum + item.affixes.length, 0),
    ...bytes(text), cap: SAVE_MAX_BYTES, boundaries }
}

async function main() {
  const { execFileSync } = await import('node:child_process')
  const { mkdirSync, writeFileSync } = await import('node:fs')
  const { cpus, release, totalmem } = await import('node:os')
  const build = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim()
  const report = { build, node: process.version, hardware: { cpu: cpus()[0]?.model, memoryBytes: totalmem(), release: release() },
    ...runBench(), save: measureSave(build) }
  mkdirSync('game/.play-out/m2', { recursive: true })
  writeFileSync('game/.play-out/m2/bench.json', JSON.stringify(report, null, 2) + '\n')
  const { intervals: _stressIntervals, ...stressSummary } = report.stress
  const { intervals: _dummyIntervals, ...dummySummary } = report.dummies
  console.log(JSON.stringify({ ...report, stress: stressSummary, dummies: dummySummary }))
  if (Math.max(report.save.utf8, report.save.utf16) > report.save.cap ||
    report.save.boundaries.some(test => !test.accepted || !test.rejected)) process.exitCode = 1
}

if (typeof process !== 'undefined' && process.argv[1]?.endsWith('/m2-bench.ts')) void main()
