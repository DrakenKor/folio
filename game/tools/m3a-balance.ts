import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import builds from '../scenarios/m3a-builds.json'
import pressure from '../scenarios/m3a-pressure.json'
import { clearing, profile } from '../scenarios/m3a-profile'
import { clearance, decide } from '../scenarios/m3a-controller'
import type { Policy, Sight, Warning } from '../scenarios/m3a-controller'
import * as core from '../src/sim/core'
import type { CharacterData, Command, Operation, World } from '../src/sim/core'
import { buildScenario } from '../src/sim/scenarios'

type Build = typeof builds.builds[number]
type Spawn = [kind: string, x: number, z: number]
type Result = { policy: Policy; seed: number; family: string; outcome: 'win' | 'death' | 'timeout'; ticks: number; aggro: number; hp: number; maxHP: number; applied: number; directHits: number }
const actor = (w: World) => w.entities.find(a => a.id === w.playerId)!
const policies: Policy[] = ['competent', 'greedy', 'idle']
const seeds = Object.keys(pressure.offsets).map(Number)
const results: Result[] = []
let failures = 0
const checks: { name: string; pass: boolean; reason?: string }[] = []
function check(name: string, fn: () => unknown) {
  try {
    const result = fn()
    checks.push({ name, pass: true })
    console.log(JSON.stringify({ name, result }))
  }
  catch (error) {
    if (!(error instanceof assert.AssertionError)) throw error
    failures++
    checks.push({ name, pass: false, reason: error.message })
    console.log(JSON.stringify({ name, assertion: error.message }))
  }
}
function edit(w: World, op: Operation) {
  const events = core.step(w, { ...core.IDLE_COMMAND, operations: [op] })
  assert(events.some(e => e.type === 'operationAccepted'), JSON.stringify({ op, events }))
}
function gear(source: World, build: Build) {
  const data = core.exportCharacter(source), c = data.character
  assert.equal(c.items.length, 5)
  for (const item of c.items) {
    assert.equal(item.id, c.equipment[item.role])
    assert.equal(item.baseId, builds.bases[item.role])
    assert.deepEqual(item.affixes, [])
  }
  assert(Object.values(c.folds).every(f => f.length === 0), 'starter drawings have no folds')
  Object.assign(c, { rank: builds.rank, xp: builds.xp, points: 8 })
  c.graph.seed = builds.graphSeed
  for (const roll of builds.rolls) {
    const item = c.items.find(i => i.role === roll.role)!
    const family = profile(source).affixes.find(a => a.id === roll.familyId), tier = family?.tiers.find(t => t.tier === roll.tier)
    assert(family?.roles.includes(item.role) && family.category === 'offensive' && tier && tier.unlockRank <= c.rank && roll.roll >= tier.min && roll.roll <= tier.max, 'legal roll ' + roll.familyId)
    item.affixes = [{ category: 'offensive', familyId: roll.familyId, tier: 1, roll: roll.roll }]
  }
  const w = core.loadCharacter(data, source.content).world
  for (const nodeId of build.allocations) edit(w, { type: 'allocate', nodeId })
  edit(w, { type: 'activateShape', shapeId: build.shape, active: true })
  const paid = actor(w).character!
  assert.deepEqual(paid.graph.allocations.slice().sort(), build.allocations.slice().sort())
  assert.equal(paid.points, 0)
  assert.deepEqual(paid.graph.activeShapes, [build.shape])
  return w
}
function pack(seed: number): Spawn[] {
  const offsets = pressure.offsets[String(seed) as keyof typeof pressure.offsets]
  return pressure.pack.map((kind, i) => [kind, ...[0, 1].map(j => pressure.origins[i]![j]! + offsets[i]![j]! * pressure.offsetUnit)] as Spawn)
}
/** All fixture construction ends before the pre-aggro snapshot. No actor is repositioned during play. */
function encounter(seed: number, spawns: Spawn[], build?: Build) {
  const source = clearing(seed), w = build ? gear(source, build) : source
  const absent = spawns.filter(([kind]) => !w.content.enemies.some(e => e.id === kind))
  assert(!absent.length, 'missing encounter cards: ' + absent.map(s => s[0]).join(', '))
  if (build) {
    assert(w.build === 'm3-sim-v1', 'family refits require the M3 clearing')
    edit(w, { type: 'refitWeapon', familyId: build.family } as unknown as Operation)
    assert.deepEqual(actor(w).character!.loadout.slice(0, 4), [...(build.family === 'hemblade' ? ['span-cut', 'open-hem'] : ['cast-loop', 'gather-line']), 'fold-dart', 'rill-fan'])
  }
  w.encounter!.phase = 'active'
  w.encounter!.attempt = 1
  const p = actor(w)
  assert.equal(p.health, p.maxHealth)
  assert.equal(p.maxHealth, 148)
  for (const [kind, x, z] of spawns) {
    const def = w.content.enemies.find(e => e.id === kind)!
    core.spawnEntity(w, {
      kind, pos: { x: p.pos.x + x, z: p.pos.z + z }, faction: 'enemy', radius: def.radius, health: def.maxHealth, maxHealth: def.maxHealth,
      facing: core.fmath.atan2(-z, -x), skills: { primary: def.skillId, secondary: null }, ai: { enemyId: kind, phase: 'idle', targetId: null, ageTicks: 0 }
    })
  }
  return core.restore(core.serialize(w))
}
function warnings(w: World): Warning[] {
  const inspect = Reflect.get(core, 'inspectZone') as undefined | ((world: World) => { ok: boolean; value: { warnings: Warning[] } })
  assert(inspect, 'clearing must publish committed warning footprints through inspectZone')
  const result = inspect(w)
  assert(result.ok && Array.isArray(result.value.warnings), 'visible zone warnings')
  for (const warn of result.value.warnings) {
    assert(Number.isInteger(warn.sourceId) && Number.isInteger(warn.dueTick) && Number.isInteger(warn.startTick), 'warning source and timing')
    const f = warn.footprint
    assert(f && ['sector', 'disc', 'lane'].includes(f.kind) && Number.isFinite(f.origin?.x) && Number.isFinite(f.origin?.z), 'warning geometry')
    const required = f.kind === 'disc' ? [f.radius] : [f.direction, f.reach, f.kind === 'sector' ? f.arcRadians : f.halfWidth]
    assert(required.every(Number.isFinite), 'finite committed dimensions')
  }
  return result.value.warnings
}
function attempt(w: World, build: Build, policy: Policy): Result {
  const p = actor(w), start = w.tick, maxHP = p.maxHealth, history: Sight[] = [], ids = w.entities.filter(e => e.ai).map(e => e.id)
  const killed = new Set<number>()
  let aggro = 0, applied = 0, directHits = 0
  for (let t = 0; t < pressure.timeout; t++) {
    const enemies = w.entities.filter(e => ids.includes(e.id) && !e.death)
    history.push({ tick: t, pos: { ...p.pos }, enemies: enemies.map(e => ({ id: e.id, pos: { ...e.pos } })), warnings: structuredClone(warnings(w)).map(v => ({ ...v, startTick: v.startTick - start, dueTick: v.dueTick - start })) })
    const cmd = decide(history.length > pressure.delay ? history.shift() : undefined, build.family, policy)
    const events = core.step(w, cmd)
    if (!aggro && (w.entities.some(e => e.ai?.targetId === p.id) || events.some(e => e.type === 'hit' && e.targetId === p.id))) aggro = w.tick - start
    for (const e of events) if (e.type === 'damage' && ids.includes(e.actorId) && e.targetId === p.id) applied += e.amount
    directHits += events.filter(e => e.type === 'hit' && ids.includes(e.actorId) && e.targetId === p.id).length
    for (const event of events) if (event.type === 'death' && ids.includes(event.targetId)) killed.add(event.targetId)
    const dead = !!p.death, cleared = ids.every(id => killed.has(id))
    if (dead || cleared || t + 1 === pressure.timeout) {
      if (cleared) assert(aggro > 0, 'pack cleared after first aggro')
      const outcome = dead ? 'death' : cleared ? 'win' : 'timeout'
      return { policy, seed: w.seed, family: build.family, outcome, aggro, ticks: w.tick - start, hp: p.health, maxHP, applied, directHits }
    }
  }
  throw Error('unreachable timeout')
}
const median = (a: number[]) => {
  a.sort((x, y) => x - y)
  return (a[Math.floor((a.length - 1) / 2)]! + a[Math.floor(a.length / 2)]!) / 2
}
function paired(trace: typeof pressure.traces[number], seed: number) {
  const world = encounter(seed, trace.actors as Spawn[]), bytes = core.serialize(world)
  const observeRun = (escape: boolean) => {
    const w = core.restore(bytes), p = actor(w), count = trace.actors.length, first = new Map<number, Warning>()
    const origin = { ...p.pos }
    const script = escape ? trace.escape : trace.stand
    let overlap = false, earliest = Infinity
    const hits: { id: number; amount: number; tick: number }[] = []
    for (let i = 0; i < 240; i++) {
      const published = warnings(w)
      for (const warn of published) {
        const prior = first.get(warn.sourceId)
        if (!prior) first.set(warn.sourceId, structuredClone(warn))
        else if (prior.id === warn.id) assert.deepEqual(warn.footprint, prior.footprint, 'committed footprint remains fixed')
        else {
          const kind = w.entities.find(e => e.id === warn.sourceId)?.kind
          const recovery = pressure.traces.find(t => t.actors.length === 1 && t.actors[0]![0] === kind)!.recovery
          assert(warn.startTick >= prior.dueTick + recovery, 'hostile recovery opening')
        }
      }
      if (first.size) earliest = Math.min(earliest, ...[...first.values()].map(v => v.startTick))
      if (count > 1 && published.length >= count && published.every(v => v.startTick <= w.tick && v.dueTick >= w.tick && clearance(origin, v) <= p.radius)) overlap = true
      const edge = script.findLast(e => e.at <= w.tick - earliest) ?? script[0]!
      const cmd: Command = {
        move: { x: edge.move[0]!, z: edge.move[1]! }, buttons: edge.buttons,
        aim: edge.buttons & (core.Button.Primary | core.Button.Secondary) ? { x: origin.x + 3, z: origin.z } : null
      }
      for (const e of core.step(w, cmd)) if (e.type === 'damage' && e.targetId === p.id) hits.push({ id: e.actorId, amount: e.amount, tick: e.tick })
      if (first.size === count && w.tick > Math.max(...[...first.values()].map(v => v.dueTick)) + trace.recovery) break
    }
    assert.equal(first.size, count, 'all named warnings actually commit')
    if (count > 1) assert(overlap, 'both footprints overlap in time')
    for (const warning of first.values()) {
      const source = world.entities.find(e => e.id === warning.sourceId)!
      const min = pressure.traces.find(t => t.actors.length === 1 && t.actors[0]![0] === source.kind)!.windup
      assert(warning.dueTick - warning.startTick >= min, 'minimum visible lead time')
    }
    return { warnings: [...first.values()], hits }
  }
  const still = observeRun(false), escape = observeRun(true)
  assert.deepEqual(escape.warnings, still.warnings, 'same first commitments before escape')
  for (const warning of still.warnings) {
    const hits = still.hits.filter(e => e.id === warning.sourceId && e.tick >= warning.dueTick && e.tick <= warning.dueTick + 2)
    assert.equal(hits.length, 1, 'stationary player takes the warned strike')
    const [min, max] = world.entities.find(e => e.id === warning.sourceId)?.kind === 'silt-bell' ? [50, 68] : [30, 42]
    assert(hits[0]!.amount >= min! && hits[0]!.amount <= max!, 'applied starter shield damage in band')
  }
  assert.equal(still.hits.length, still.warnings.length, 'no untelegraphed chip or repeated contact')
  assert.equal(escape.hits.length, 0, 'legal delayed escape is hitless')
  return { start: core.hashWorld(world), still, escape }
}

for (const path of ['../scenarios/m3a-profile.ts', '../scenarios/m3a-builds.json', '../scenarios/m3a-pressure.json', '../scenarios/m3a-controller.ts', './m3a-balance.ts']) {
  console.log('sha256', createHash('sha256').update(readFileSync(new URL(path, import.meta.url))).digest('hex'), path)
}
for (const build of builds.builds) {
  check('paid graph and tier legality ' + build.family, () => {
    const world = gear(buildScenario('m2-clearing', 7), build)
    assert.equal(actor(world).maxHealth, 148)
    assert.equal(actor(world).health, 148)
    const data: CharacterData = core.exportCharacter(world)
    return { points: data.character.points, shape: data.character.graph.activeShapes }
  })
  check('ordinary controller inputs ' + build.family, () => {
    const w = buildScenario('m2-clearing', 7)
    edit(w, { type: 'beginEncounter' })
    const p = actor(w), enemy = w.entities.find(e => e.ai)!
    enemy.pos = { x: p.pos.x + 1.2, z: p.pos.z }
    const sight = { pos: { ...p.pos }, enemies: [{ id: enemy.id, pos: { ...enemy.pos } }], warnings: [], tick: 0 }
    const seen = new Set<number>()
    for (let tick = 0; tick < 120; tick++) {
      sight.tick = tick
      const competent = decide(sight, build.family, 'competent'), greedy = decide(sight, build.family, 'greedy')
      assert.deepEqual(greedy.move, { x: 0, z: 0 })
      assert.deepEqual(greedy.aim, competent.aim)
      assert.equal(greedy.buttons, competent.buttons)
      assert.deepEqual(decide(sight, build.family, 'idle'), core.IDLE_COMMAND)
      seen.add(competent.buttons)
    }
    assert.deepEqual(decide(undefined, build.family, 'competent'), core.IDLE_COMMAND)
    const expected = build.family === 'hemblade' ? [core.Button.Primary, core.Button.Secondary] : [core.Button.Skill2, core.Button.Primary, core.Button.Secondary]
    assert.deepEqual([...seen], expected)
    return { observedButtons: [...seen] }
  })
  for (const seed of seeds) for (const policy of policies) check([build.family, seed, policy].join('/'), () => {
    const result = attempt(encounter(seed, pack(seed), build), build, policy)
    results.push(result)
    return result
  })
  const rows = results.filter(r => r.family === build.family), wins = rows.filter(r => r.policy === 'competent' && r.outcome === 'win')
  const clear = median(wins.map(r => r.ticks - r.aggro)), lost = median(wins.map(r => r.applied / r.maxHP))
  const gates: [string, boolean][] = [
    ['wins >= 8', wins.length >= pressure.wins], ['clear 360..840 ticks', clear >= pressure.clearTicks[0]! && clear <= pressure.clearTicks[1]!],
    ['damage 20..65 percent', lost >= pressure.damageFraction[0]! && lost <= pressure.damageFraction[1]!],
    ['8 damaged starts', rows.filter(r => r.policy === 'competent' && r.directHits > 0).length >= pressure.damagedStarts],
    ['5 greedy deaths', rows.filter(r => r.policy === 'greedy' && r.outcome === 'death').length >= pressure.greedyDeaths],
    ['10 idle deaths within 720 ticks of aggro', rows.filter(r => r.policy === 'idle' && r.aggro > 0 && r.outcome === 'death' && r.ticks - r.aggro <= pressure.idleLimit).length === 10]
  ]
  for (const [gate, pass] of gates) check(build.family + ' ' + gate, () => assert(pass, gate + '; measured attempts ' + rows.length))
}
for (const seed of seeds) for (const trace of pressure.traces) check('paired/' + trace.name + '/' + seed, () => paired(trace, seed))
console.log(JSON.stringify({ checks: checks.length, failures, measuredAttempts: results.length }))
process.exitCode = Number(failures > 0)
