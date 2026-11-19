import { expect, it } from 'vitest'
import { Button, hashWorld, previewAction, Recorder, restore, serialize, step, verifyReplay } from '../../core'
import type { Command, Entity, SimEvent, World } from '../../core'
import { profile } from '../../../../scenarios/m3a-profile'
import { accepted, arena, clearing, command, damage, east, origin, playerOf, run, strikes, tap, target } from './fixtures'
import type { Family } from './fixtures'

const { Primary: left, Secondary: right, Skill1: dart, Skill2: fan } = Button
const action = (events: SimEvent[], id: string) => events.filter(e => e.type === 'action' && e.action === id)
const amounts = (events: SimEvent[], id: number) => damage(events, id).filter(e => e.skillId !== 'emberprint').map(e => e.amount)
const moving = (vx: number, vz: number, ticks = 200) => ({ knockback: { vel: { x: vx, z: vz }, remainingTicks: ticks } })

/** A direct 31-damage projectile reaches the player on the sixth tick, before the target moves. */
function incoming(w: World, source: Entity, tick = 6) {
  const sign = Math.sign(source.pos.x)
  w.projectiles.push({
    id: w.nextId++, ownerId: source.id, faction: source.faction, skillId: 'qa-bolt', actionStartTick: w.tick,
    pos: { x: sign * (.32 + .02 + (tick - .5) * .2), z: 0 }, vel: { x: -sign * 12, z: 0 }, radius: .02, ageTicks: 0, lifetimeTicks: 180,
    damage: 31, knockback: { speed: 6, ticks: 4 }, impactPauseTicks: 0, hitFlashTicks: 0
  })
}

it.each(['two hits', 'miss', 'one activation hits twice', 'expired', 'refreshed'] as const)('C01 Open Hem pays two live seams at start: %s', condition => {
  const w = arena(), a = target(w, 1), b = target(w, 1.4, .15)
  tap(w, left)
  if (condition === 'refreshed') run(w, 74)
  if (condition !== 'one activation hits twice') tap(w, left, 36, condition === 'miss' ? { x: -4, z: 0 } : east)
  if (condition === 'expired') run(w, 121)
  if (condition === 'refreshed') run(w, 50)
  const ready = ['two hits', 'refreshed'].includes(condition), result = tap(w, right)
  expect(action(result, 'open-hem')).toHaveLength(ready ? 1 : 0)
  expect(strikes(result, 'open-hem').map(e => e.targetId)).toEqual(ready ? [a.id, b.id] : [])
  expect(playerOf(w).pos.x).toBeCloseTo(ready ? 2.4 : 0, 4)
  expect(action(tap(w, right), 'open-hem')).toHaveLength(0)
})

it('C02 a missed step or direct interrupt spends the seams and cancels future contacts', () => {
  for (const interrupt of [false, true]) {
    const w = arena(), enemy = target(w, 1)
    tap(w, left)
    tap(w, left)
    if (interrupt) incoming(w, enemy, 2)
    const result = tap(w, right, 40, interrupt ? east : { x: -4, z: 0 })
    expect(action(result, 'open-hem')).toHaveLength(1)
    expect(strikes(result, 'open-hem')).toEqual([])
    expect(action(tap(w, right), 'open-hem')).toEqual([])
  }
})

it.each([1, 23, 24, 44, 45])('C03 Plinth roots for %i eligible ticks, then stamps once at released strength', held => {
  const w = arena('plumbshoe'), victim = target(w, 1)
  const before = run(w, held, command(left, east, { x: 0, z: 1 }))
  expect(amounts(before, victim.id)).toEqual([])
  expect(playerOf(w).pos).toEqual(origin)
  const after = run(w, 30)
  expect(amounts(after, victim.id)).toEqual([held >= 24 ? 42 : 24])
})

it.each(['charge', 'channel'] as const)('C04 capped %s needs a physical up before rearming', type => {
  const w = arena('plumbshoe'), v = target(w, 1), bit = type === 'charge' ? left : fan
  const held = run(w, 150, command(bit))
  expect(amounts(held, v.id)).toEqual(type === 'charge' ? [42] : [18, 18, 18, 18])
  run(w, 1)
  const repeated = [...run(w, 24, command(bit)), ...run(w, 30)]
  expect(amounts(repeated, v.id).length).toBeGreaterThan(0)
})

it.each(['dodge', 'cancelHeld', 'interrupt'] as const)('C05 %s discards unpaid charge and channel contacts', reason => {
  for (const bit of [left, fan]) {
    const w = arena('plumbshoe'), v = target(w, 1)
    run(w, 3, command(bit))
    if (reason === 'interrupt') incoming(w, v, 1)
    const canceller = { ...command(reason === 'dodge' ? bit | Button.Dodge : reason === 'interrupt' ? bit : 0), cancelHeld: reason === 'cancelHeld' }
    const events = [...run(w, 1, canceller), ...run(w, 40)]
    expect(amounts(events, v.id)).toEqual([])
    if (reason === 'dodge') expect(events.some(e => e.type === 'dodge')).toBe(true)
  }
})

it('C06 ordinary release during pause survives re-press, snapshot and replay', () => {
  const w = arena('plumbshoe'), v = target(w, 1)
  run(w, 24, command(left))
  playerOf(w).impactPauseTicks = 3
  expect(amounts(run(w, 1), v.id)).toEqual([])
  const saved = serialize(w), copy = restore(saved), inputs = Array.from({ length: 14 }, () => command(left))
  const events = inputs.flatMap(c => step(w, c))
  expect(inputs.flatMap(c => step(copy, c))).toEqual(events)
  expect(amounts(events, v.id)).toEqual([42])
  expect(damage(events)[0]!.tick).toBeGreaterThan(27)
  expect(serialize(copy)).toBe(serialize(w))
})

it.each(['front', 'rear', 'distant', 'lethal', 'whiff', 'after'] as const)('C07 Brace answers the first eligible frontal strike once: %s', kind => {
  const fold = kind === 'after' ? { 'brace-mark': ['after-pleat'] } : {}
  const w = arena('plumbshoe', fold as Record<string, string[]>), p = playerOf(w), v = target(w, kind === 'distant' ? 3 : kind === 'rear' ? -1.2 : 1.2)
  if (kind === 'lethal') p.health = 15
  if (kind !== 'whiff') incoming(w, v)
  const result = tap(w, right, 45)
  const caught = kind !== 'rear' && kind !== 'whiff'
  expect(amounts(result, p.id)).toEqual(kind === 'whiff' ? [] : [kind === 'lethal' ? 15 : caught ? 16 : 31])
  expect(amounts(result, v.id)).toEqual(kind === 'front' ? [24] : kind === 'after' ? [12, 12] : [])
  if (caught && kind !== 'lethal') expect(p.pos).toEqual(origin)
})

it('C08 Reel needs a live eye, rejects recast, lands a fresh outbound and anchored return hit', () => {
  const w = arena('verge-reel'), v = target(w, 3)
  expect(action(tap(w, right), 'gather-line')).toEqual([])
  const out = tap(w, left, 55)
  expect(amounts(out, v.id)).toEqual([18])
  expect(action(tap(w, left, 18), 'cast-loop')).toEqual([])
  const back = [...run(w, 1, command(right)), ...run(w, 45, command(0, east, { x: 0, z: 1 }))]
  expect(amounts(back, v.id)).toEqual([24])
  expect(action(tap(w, right), 'gather-line')).toEqual([])
})

it('C09 live recall replaces outbound, but expiry before its active age whiffs', () => {
  for (const age of [22, 154]) {
    const w = arena('verge-reel'), near = target(w, 1), far = target(w, 6.8)
    const out = tap(w, left, age - 1), back = tap(w, right, 60)
    expect(amounts(out, near.id)).toEqual([18])
    expect(amounts(back, near.id)).toEqual(age === 22 ? [24] : [])
    expect(amounts([...out, ...back], far.id)).toEqual(age === 22 ? [] : [18])
  }
})

it.each(['occupied', 'lured', 'empty', 'expired', 'replaced'] as const)('C10 armed Lay Bed triggers once: %s', mode => {
  const w = arena('hearth-frame'), v = target(w, 3, mode === 'occupied' ? 0 : 2,
    mode === 'lured' ? moving(0, -2) : mode === 'expired' ? moving(0, -.25) : {})
  const aim = { x: 3, z: 0 }, events = tap(w, left, 19, aim)
  if (mode === 'replaced') events.push(...tap(w, left, 25, v.pos))
  events.push(...run(w, 300))
  const hits = strikes(events, 'lay-bed')
  expect(hits.map(e => [e.targetId, e.amount])).toEqual(['occupied', 'lured', 'replaced'].includes(mode) ? [[v.id, 28]] : [])
  if (mode === 'occupied') expect(hits[0]!.tick).toBe(25)
})

it('C11 Rill roots, pulses every 15 eligible ticks, turns at most 15 degrees and cancels before opening', () => {
  const w = arena(), v = target(w, 3), side = target(w, 0, 3)
  expect(amounts(tap(w, fan, 32), v.id)).toEqual([])
  const start = w.tick + 1, held = run(w, 7, command(fan, east, { x: 1, z: 0 }))
  const turn = run(w, 1, command(fan, { x: 0, z: 4 }))
  expect(playerOf(w).action?.direction).toBeGreaterThan(0)
  expect(playerOf(w).action?.direction).toBeLessThanOrEqual(Math.PI / 12 + 1e-8)
  const pulses = strikes([...held, ...turn, ...run(w, 56, command(fan, { x: 0, z: 4 }))], 'rill-fan')
  expect(pulses.map(e => [e.tick - start, e.targetId, e.amount])).toEqual([[6, v.id, 18], [21, side.id, 18], [36, side.id, 18], [51, side.id, 18]])
  expect(playerOf(w).pos).toEqual(origin)
})

it.each(['base', 'splay', 'through', 'both'] as const)('F01 Dart paths, damage and per-dart contact limits: %s', mode => {
  const folds = mode === 'both' ? ['through-pleat', 'splay-pleat'] : mode === 'base' ? [] : [mode + '-pleat']
  const w = arena('hemblade', { 'fold-dart': folds })
  // The broad first body occupies all three rays. Each dart must count that contact.
  const first = target(w, 1, 0, { radius: .43 }), second = target(w, 2.5), side = target(w, 2.5, .81), other = target(w, 2.5, -.81)
  const third = target(w, 4), preview = previewAction(w, playerOf(w).id, 'fold-dart', first.id)
  const amount = { base: 18, splay: 8, through: 13, both: 6 }[mode]
  expect(preview).toMatchObject({ ok: true, value: { damage: { applied: amount } } })
  const events = tap(w, dart, 65), expected = mode === 'both' ? [first, second, side, other] : mode === 'through' ? [first, second] : [first]
  expect(damage(events).map(e => e.targetId).sort((a, b) => a - b)).toEqual(expected.map(e => e.id))
  for (const t of expected) expect(amounts(events, t.id)).toEqual([amount])
  expect(amounts(events, third.id)).toEqual([])
})

it.each([false, true])('F02 After splits one stationary ground contact; walking out=%s', movingTarget => {
  const w = arena('hemblade', { 'span-cut': ['after-pleat'] }), v = target(w, 1)
  if (movingTarget) {
    // A second public projectile pushes the walker beyond the original footprint after the cut.
    const p = playerOf(w)
    w.projectiles.push({
      id: w.nextId++, ownerId: p.id, faction: p.faction, skillId: 'qa-bolt', actionStartTick: 0, pos: { x: -1.2, z: 0 },
      vel: { x: 12, z: 0 }, radius: .02, ageTicks: 0, lifetimeTicks: 60, damage: 1, knockback: { speed: 12, ticks: 10 }, impactPauseTicks: 0, hitFlashTicks: 0
    })
  }
  const events = [...run(w, 1, command(left)), ...run(w, 6), ...run(w, 25, command(0, east, { x: -1, z: 0 }))]
  expect(damage(events, v.id).filter(e => e.skillId !== 'qa-bolt').map(e => [e.tick, e.amount])).toEqual(movingTarget ? [[7, 12]] : [[7, 12], [25, 12]])
})

it('F03 Hinge retraces only final half, fresh set and separately priced stroke', () => {
  const w = arena('verge-reel', { 'cast-loop': ['hinge-pleat'] }), near = target(w, 1), far = target(w, 5)
  const events = tap(w, left, 100)
  expect(amounts(events, near.id)).toEqual([14])
  expect(amounts(events, far.id)).toEqual([14, 9])
})

it.each(['tile', 'fan'])('F04 Rim %s hits both offset lanes and leaves centre quiet', kind => {
  const w = arena('hearth-frame', { [kind === 'tile' ? 'lay-bed' : 'rill-fan']: ['rim-pleat'] })
  const centre = target(w, 3), up = target(w, 3, .8), down = target(w, 3, -.8)
  const cmd = command(kind === 'tile' ? left : fan, { x: 3, z: 0 })
  const events = [...run(w, 7, cmd), ...run(w, 35)]
  expect(amounts(events, centre.id)).toEqual([])
  for (const t of [up, down]) expect(amounts(events, t.id)).toEqual([kind === 'tile' ? 21 : 14])
})

it('F05 Catch delays the committed line, excludes occupants and stamps the next new entrant once', () => {
  const w = arena('hearth-frame', { 'lift-print': ['catch-pleat'] }), v = target(w, 2), entrant = target(w, 2, 2.3, moving(0, -2.8))
  const events = tap(w, right, 90)
  expect(damage(events).map(e => [e.targetId, e.amount])).toEqual([[v.id, 14], [entrant.id, 9]])
  expect(damage(events)[0]!.tick).toBe(18)
})

it.each(['clean', 'prepared', 'expired', 'lethal', 'pulse', 'through-catch', 'immune'] as const)('P01 Lay Bed then Lift Print impression: %s', mode => {
  const folds: Record<string, string[]> = mode === 'through-catch' ? { 'lift-print': ['through-pleat', 'catch-pleat'] } : {}
  const w = arena('hearth-frame', folds), v = target(w, 2, 0, { health: mode === 'lethal' ? 44 : 1000 }), side = target(w, 2, 1.2)
  if (mode === 'through-catch') target(w, 3.2)
  if (mode !== 'clean') {
    const prep = tap(w, left, 26, v.pos)
    expect(amounts(prep, v.id)).toEqual([28])
    expect(w.ailments.some(a => a.id === 'emberprint' && a.targetId === v.id)).toBe(true)
  }
  if (mode === 'expired') run(w, 125)
  if (mode === 'pulse') run(w, 22) // Placement at 7, arms at 25, pulse and lift at 55.
  if (mode === 'immune') immune(v, w)
  const events = tap(w, right, 40)
  const prepared = !['clean', 'expired', 'immune'].includes(mode)
  expect(amounts(events, side.id)).toEqual(prepared ? [16] : [])
  if (prepared) expect(w.ailments.filter(a => a.id === 'emberprint' && [side.id, v.id].includes(a.targetId))).toEqual([])
  if (mode === 'pulse') expect(damage(events, v.id).slice(0, 2).map(e => e.skillId)).toEqual(['emberprint', 'lift-print'])
  if (mode === 'lethal') expect(events.filter(e => e.type === 'death' && e.targetId === v.id)).toHaveLength(1)
  if (mode === 'immune') expect(w.ailments.some(a => a.id === 'emberprint' && a.targetId === v.id)).toBe(true)
})

function immune(v: Entity, w: World) {
  v.action = { id: 'dodge', kind: 'dodge', direction: 0, startTick: w.tick - 2, ageTicks: 2, hitTargetIds: [], projectileSpawned: false }
  v.impactPauseTicks = 50
}
it.each(['prepared', 'clean', 'expired', 'immune', 'alone'] as const)('P02 Fan then Reel return releases Draftbind, closest eligible neighbour: %s', mode => {
  const w = arena('verge-reel'), v = target(w, 2)
  const neighbours = mode === 'alone' ? [] : [target(w, 2, 1), target(w, 2, -1)]
  if (mode !== 'clean') {
    const prep = [...run(w, 7, command(fan)), ...run(w, 24)]
    expect(amounts(prep, v.id)).toEqual([18])
    expect(w.ailments.some(a => a.targetId === v.id && a.id === 'draftbind')).toBe(true)
  }
  if (mode === 'expired') run(w, 91)
  tap(w, left, 31)
  if (mode === 'immune') immune(v, w)
  const events = tap(w, right, 32)
  expect(amounts(events, v.id)).toEqual(mode === 'immune' ? [] : [24])
  expect(damage(events).filter(e => e.targetId !== v.id).map(e => [e.targetId, e.amount])).toEqual(mode === 'prepared' ? [[neighbours[0]!.id, 12]] : [])
  expect(w.ailments.some(a => a.targetId === v.id && a.id === 'draftbind')).toBe(mode === 'immune' && w.tick < 98)
})

it.each(['prepared', 'clean', 'expired', 'immune'] as const)('P03 Dart then charged Plinth roots only a previously Burdened walker: %s', mode => {
  const w = arena('plumbshoe'), p = playerOf(w), v = target(w, 1.2)
  const def = w.content.enemies[0]!
  def.moveSpeed = .12
  def.acquireRange = 10
  def.attackRange = .05
  v.ai = { enemyId: def.id, phase: 'chase', targetId: p.id, ageTicks: 0 }
  if (mode !== 'clean') {
    tap(w, dart, 28)
    expect(w.ailments.some(a => a.id === 'burden' && a.targetId === v.id)).toBe(true)
  }
  if (mode === 'expired') run(w, 95)
  run(w, 24, command(left))
  if (mode === 'immune') immune(v, w)
  const events = run(w, 5), pos = { ...v.pos }
  expect(amounts(events, v.id)).toEqual(mode === 'immune' ? [] : [42])
  if (mode === 'prepared') {
    expect(w.ailments.some(a => a.id === 'burden' && a.targetId === v.id)).toBe(false)
    run(w, 23)
    expect(v.pos).toEqual(pos)
    run(w, 2)
    expect(v.pos.x).toBeLessThan(pos.x)
  } else if (mode !== 'immune') {
    run(w, 3)
    expect(v.pos.x).toBeLessThan(pos.x)
  }
  else expect(w.ailments.some(a => a.id === 'burden' && a.targetId === v.id)).toBe(true)
})

type Continuation = [string, Family, number, number, number, number]
const checkpoints: Continuation[] = [
  ['held charge', 'plumbshoe', left, 24, 0, 42], ['active counter', 'plumbshoe', right, 4, 0, 24],
  ['outbound eye', 'verge-reel', left, 10, 0, 18], ['returning eye', 'verge-reel', right, 5, 0, 24],
  ['pending stamp', 'hemblade', left, 9, 0, 12], ['armed tile', 'hearth-frame', left, 30, 0, 28],
  ['channel', 'hemblade', fan, 9, fan, 18]
]
it.each(checkpoints)('R01 restore during %s reproduces meaningful contact, all events, canonical bytes and replay hashes', (name, family, bit, prefix, held, amount) => {
  const w = arena(family, name === 'pending stamp' ? { 'span-cut': ['after-pleat'] } : {})
  const victim = target(w, name === 'armed tile' ? 3 : name.includes('eye') ? 3 : 1, name === 'armed tile' ? 2 : 0, name === 'armed tile' ? moving(0, -1.3) : {})
  const far = name.includes('eye') ? target(w, 5) : undefined
  if (name === 'returning eye') tap(w, left, 58)
  if (name === 'active counter') incoming(w, victim, 8)
  run(w, prefix, command(bit, { x: 3, z: 0 }))
  const bytes = serialize(w), other = restore(bytes), recorder = new Recorder(other)
  const suffix: Command[] = Array.from({ length: 75 }, () => command(held))
  const expected = suffix.flatMap(c => step(w, c))
  const actual = suffix.flatMap(c => {
    const events = step(other, c)
    recorder.record(c)
    return events
  })
  if (far) {
    const order = name === 'outbound eye' ? [victim.id, far.id] : [far.id, victim.id]
    expect(damage(actual).map(e => e.targetId)).toEqual(order)
  }
  const contacts = damage(actual, victim.id).filter(e => e.skillId !== 'emberprint')
  expect(contacts.map(e => e.amount)).toEqual(name === 'channel' ? [18, 18, 18] : [amount])
  if (name === 'channel') expect(contacts.map(e => e.tick)).toEqual([22, 37, 52])
  if (name === 'pending stamp') expect(contacts[0]!.tick).toBe(25)
  expect(actual).toEqual(expected)
  expect(serialize(other)).toBe(serialize(w))
  expect(hashWorld(other)).toBe(hashWorld(w))
  expect(verifyReplay(recorder.exportReplay())).toEqual({ ok: true })
})

it('F06 Through + Catch on Lift delays two priced contacts; only the first print pays and creates an entrant mark', () => {
  const w = arena('hearth-frame', { 'lift-print': ['through-pleat', 'catch-pleat'] })
  const a = target(w, 2), b = target(w, 3.5), c = target(w, 4.6), nearA = target(w, 2, 1.1), nearB = target(w, 3.5, 1.1)
  // The tile arms once and prepares both primaries; both neighbours start outside its footprint.
  tap(w, left, 28, { x: 2.75, z: 0 })
  expect(w.ailments.filter(s => s.id === 'emberprint').map(s => s.targetId)).toEqual([a.id, b.id])
  const start = w.tick + 1, result = tap(w, right, 20)
  const direct = strikes(result, 'lift-print')
  for (const targetId of [a.id, b.id]) expect(direct.some(e => e.targetId === targetId && e.tick === start + 5 + 12 && e.amount === 10)).toBe(true)
  expect(amounts(result, c.id)).toEqual([])
  expect(amounts(result, nearA.id)).toEqual([16])
  expect(amounts(result, nearB.id)).toEqual([])
  expect(w.ailments.filter(s => s.id === 'emberprint').map(s => s.targetId)).toEqual([b.id])
})

it('F07 split rays hit three separate silhouettes at ±18°, including after the central target is immune', () => {
  const w = arena('hemblade', { 'fold-dart': ['splay-pleat'] }), centre = target(w, 3), a = target(w, 3, .975), b = target(w, 3, -.975)
  run(w, 3)
  immune(centre, w)
  const result = tap(w, dart, 40)
  expect(amounts(result, centre.id)).toEqual([])
  expect(amounts(result, a.id)).toEqual([8])
  expect(amounts(result, b.id)).toEqual([8])
})

it('F08 Hinge Open Hem remains exposed at the half-way endpoint and only retraces the outer half', () => {
  const w = arena('hemblade', { 'open-hem': ['hinge-pleat'] }), near = target(w, .7), far = target(w, 2)
  tap(w, left)
  tap(w, left)
  const hits = tap(w, right, 40)
  expect(amounts(hits, near.id)).toEqual([27])
  expect(amounts(hits, far.id)).toEqual([27, 18])
  expect(playerOf(w).pos.x).toBeCloseTo(1.2, 2)
})

it('P04 Catch cannot schedule a mark on zero damage; occupants present at creation never take a stationary child', () => {
  const w = arena('hearth-frame', { 'lift-print': ['catch-pleat'] }), v = target(w, 2), other = target(w, 2, .7)
  run(w, 3)
  immune(v, w)
  const result = tap(w, right, 88)
  expect(damage(result)).toEqual([])
  expect(other.health).toBe(1000)
})

it('C12 contact arbitration skips an unaffordable spender; Dodge has priority over every drawing', () => {
  const w = arena(), p = playerOf(w)
  target(w, 1)
  p.character!.loadout = ['open-hem', 'span-cut', 'fold-dart', 'rill-fan', null, null]
  p.skills = { primary: 'open-hem', secondary: 'span-cut' }
  expect(action(run(w, 1, command(left | right | dart | fan)), 'span-cut')).toHaveLength(1)
  run(w, 40)
  const events = run(w, 1, command(left | right | dart | fan | Button.Dodge))
  expect(events.some(e => e.type === 'dodge')).toBe(true)
  expect(events.some(e => e.type === 'action')).toBe(false)
})

it('C13 an armed tile expires at 180 ticks; empty casting cannot leave two live traps', () => {
  for (const replace of [false, true]) {
    const w = arena('hearth-frame'), old = target(w, 2, 3, moving(0, -1.2)), fresh = target(w, -2)
    tap(w, left, 24, { x: 2, z: 0 })
    const tail = replace ? tap(w, left, 180, fresh.pos) : run(w, 180)
    expect(amounts(tail, old.id)).toEqual(replace ? [] : [28])
    expect(amounts(tail, fresh.id)).toEqual(replace ? [28] : [])
  }
})

it('C14 death removes an eye in flight before it can reach a second actor', () => {
  const w = arena('verge-reel'), p = playerOf(w), enemy = target(w, 1), distant = target(w, 6)
  p.health = 10
  incoming(w, enemy, 17)
  const result = tap(w, left, 100)
  expect(p.health).toBe(0)
  expect(amounts(result, enemy.id)).toEqual([18])
  expect(amounts(result, distant.id)).toEqual([])
})

it('C15 same-tick direct contacts recheck death and resolve the lowest source id first', () => {
  const w = arena('plumbshoe'), p = playerOf(w), low = target(w, 1), high = target(w, -1)
  incoming(w, high)
  incoming(w, low)
  p.health = 20
  const result = run(w, 10)
  const hits = damage(result, p.id)
  expect(hits.map(h => [h.actorId, h.amount])).toEqual([[low.id, 20]])
  expect(result.filter(e => e.type === 'death' && e.targetId === p.id)).toHaveLength(1)
})

it('C16 committed step, placement and parked eye clip to reachable arena ground', () => {
  const bound = () => ({ center: { x: 0, z: 0 }, radius: 2 })
  const blade = arena()
  blade.arena = bound()
  target(blade, 1)
  tap(blade, left)
  tap(blade, left)
  tap(blade, right)
  expect(playerOf(blade).pos.x).toBeCloseTo(2, 4)
  const frame = arena('hearth-frame')
  frame.arena = bound()
  const edge = target(frame, 1.9)
  expect(amounts(tap(frame, left, 37, { x: 20, z: 0 }), edge.id)).toEqual([28])
  const reel = arena('verge-reel')
  reel.arena = bound()
  const cross = target(reel, 1.4)
  tap(reel, left, 55)
  const start = reel.tick
  const contacts = damage(tap(reel, right, 35), cross.id)
  expect(contacts.map(e => e.amount)).toEqual([24])
  expect(contacts[0]!.tick - start).toBeLessThan(9)
})

it('C17 consuming Burden preserves a previously committed enemy warning deadline', () => {
  const w = arena('plumbshoe'), p = playerOf(w), v = target(w, 1.2)
  const def = w.content.enemies[0]!
  const windup = 58
  w.content.skills.push({
    id: 'qa-rake', kind: 'melee', range: 1.6, arcRadians: Math.PI, timing: { windupTicks: windup, activeTicks: 1, recoveryTicks: 30, moveCancelTicks: 30 },
    cooldownTicks: 0, damage: 9, knockback: { ticks: 0, speed: 0 }, impactPauseTicks: 0, hitFlashTicks: 0
  })
  Object.assign(def, { acquireRange: 8, attackRange: 1.5, skillId: 'qa-rake' })
  Object.assign(v, { skills: { primary: 'qa-rake', secondary: null }, ai: { enemyId: def.id, phase: 'idle', ageTicks: 0, targetId: null } })
  tap(w, dart, 28)
  expect(w.ailments.some(a => a.id === 'burden' && a.targetId === v.id)).toBe(true)
  const committed = v.action
  expect(committed?.id).toBe('qa-rake')
  const events = [...run(w, 24, command(left)), ...run(w, 60)]
  expect(amounts(events, v.id)).toContain(42)
  expect(damage(events, p.id).some(e => e.tick === committed!.startTick + windup && e.skillId === 'qa-rake')).toBe(true)
})

it('C18 Brace catches one of two simultaneous frontal hits and halves before rounding', () => {
  const w = arena('plumbshoe'), p = playerOf(w), v = target(w, 1)
  incoming(w, v)
  incoming(w, v)
  // A positive fractional post-defence value distinguishes half-before-round from half-after-round.
  for (const shot of w.projectiles) {
    const preview = previewAction(w, p.id, 'fold-dart', v.id)
    expect(preview.ok).toBe(true)
    if (!preview.ok) throw Error('unreachable preview failure')
    shot.skillId = 'fold-dart'
    shot.recipe = { ...preview.value.recipe, sourceDamage: { weight: 30.5, heat: 0, gale: 0 }, modifiers: [] }
  }
  const result = tap(w, right, 40)
  expect(amounts(result, p.id)).toEqual([15, 31])
})

it('F09 Catch occupant is excluded and an entrant arriving after the mark expires takes no child hit', () => {
  const w = arena('hearth-frame', { 'lift-print': ['catch-pleat'] }), v = target(w, 2)
  const occupant = target(w, 2, .65), late = target(w, 2, 2.5, moving(0, -1))
  const events = tap(w, right, 140)
  expect(amounts(events, v.id)).toEqual([14])
  expect(amounts(events, occupant.id)).toEqual([])
  expect(amounts(events, late.id)).toEqual([])
})

it('F10 an immune first body still spends both geometric budgets shared by splayed piercing darts', () => {
  const w = arena('hemblade', { 'fold-dart': ['through-pleat', 'splay-pleat'] })
  const first = target(w, 1, 0, { radius: .43 }), second = target(w, 2.3, 0, { radius: .66 }), third = target(w, 4)
  run(w, 3)
  immune(first, w)
  const events = tap(w, dart, 45)
  expect(amounts(events, first.id)).toEqual([])
  expect(amounts(events, second.id)).toEqual([6])
  expect(amounts(events, third.id)).toEqual([])
})

it('R02 delayed contact survives original target death and despawn; a new entrant is hit on replay', () => {
  const w = arena('hemblade', { 'span-cut': ['after-pleat'] })
  w.content.enemies[0]!.deathTicks = 3
  const original = target(w, 1, 0, { health: 1, ai: { enemyId: 'creaseback', phase: 'idle', targetId: null, ageTicks: 0 } })
  const entrant = target(w, 1, 2, moving(0, -3.5))
  const prefix = tap(w, left, 13)
  expect(prefix.some(e => e.type === 'death' && e.targetId === original.id)).toBe(true)
  expect(w.entities.some(e => e.id === original.id)).toBe(false)
  expect(amounts(prefix, entrant.id)).toEqual([])
  const other = restore(serialize(w)), events = run(w, 30)
  expect(damage(events, entrant.id).map(e => [e.tick, e.amount])).toEqual([[25, 12]])
  expect(run(other, 30)).toEqual(events)
  expect(serialize(other)).toBe(serialize(w))
})

it('F11 echo keeps captured source modifiers after Draftbind expires and resolves current target defence', () => {
  const w = arena('hemblade', { 'span-cut': ['after-pleat'] }), p = playerOf(w), v = target(w, 1)
  w.ailments.push({ id: 'draftbind', targetId: p.id, sourceId: v.id, appliedTick: 0, expiresTick: 10, nextPulseTick: null })
  const first = tap(w, left, 9)
  expect(amounts(first, v.id)).toEqual([11])
  const saved = serialize(w), defended = restore(saved), defender = defended.entities.find(a => a.id === v.id)!
  const shield = profile(defended).itemBases.find(b => b.role === 'offhand')!
  shield.modifiers = [{ id: 'qa-armour', kind: 'reduction', damageType: 'weight', requiredTags: ['weapon', 'melee', 'area'], types: [], value: .5 }]
  defender.character = structuredClone(playerOf(defended).character!)
  for (const item of defender.character.items) {
    item.id = defended.nextItemId++
    defender.character.equipment[item.role] = item.id
  }
  const id = defended.nextItemId++
  defender.character.items.push({ id, role: 'offhand', baseId: shield.id, affixes: [] })
  defender.character.equipment.offhand = id
  // Both continuations start with the same paid echo. Only the second victim wears a matching tagged shield.
  expect(amounts(run(w, 20), v.id)).toEqual([11])
  expect(amounts(run(restore(serialize(defended)), 20), v.id)).toEqual([5])
})

it('C19 impact pause adds no held charge or channel cadence, but the world-timed echo still lands', () => {
  const shoe = arena('plumbshoe'), targetId = target(shoe, 1).id
  run(shoe, 18, command(left))
  playerOf(shoe).impactPauseTicks = 8
  run(shoe, 8, command(left))
  expect(amounts(run(shoe, 30), targetId)).toEqual([24])

  const channel = arena(), combed = target(channel, 2)
  expect(amounts(run(channel, 7, command(fan)), combed.id)).toEqual([18])
  playerOf(channel).impactPauseTicks = 5
  const pulses = run(channel, 23, command(fan))
  expect(damage(pulses, combed.id).map(e => e.tick)).toEqual([27])

  const blade = arena('hemblade', { 'span-cut': ['after-pleat'] }), cut = target(blade, 1)
  expect(amounts(tap(blade, left, 6), cut.id)).toEqual([12])
  playerOf(blade).impactPauseTicks = 24
  expect(damage(run(blade, 20), cut.id).map(e => [e.tick, e.amount])).toEqual([[25, 12]])
})

it('C20 dodge on the first pulse tick cancels before contact', () => {
  const w = arena(), victim = target(w, 2)
  run(w, 6, command(fan))
  const events = [...run(w, 1, command(fan | Button.Dodge)), ...run(w, 35)]
  expect(events.some(e => e.type === 'dodge')).toBe(true)
  expect(damage(events, victim.id)).toEqual([])
})

it('R03 entering rest clears unpaid echoes before another pack can occupy their footprint', () => {
  const w = clearing()
  accepted(w, { type: 'setFolds', skillId: 'span-cut', foldIds: ['after-pleat'] })
  accepted(w, { type: 'beginEncounter' })
  const p = playerOf(w), enemies = w.entities.filter(e => e.ai)
  expect(enemies.length).toBeGreaterThan(0)
  for (const [i, e] of enemies.entries()) {
    e.pos = { x: p.pos.x + 1, z: p.pos.z + (i - (enemies.length - 1) / 2) * .65 }
    e.health = 1
  }
  const aim = { x: p.pos.x + 4, z: p.pos.z }, ready = restore(serialize(w))
  const kill = tap(ready, left, 9, aim)
  expect(kill.filter(e => e.type === 'death')).toHaveLength(enemies.length)
  expect(ready.encounter?.phase).toBe('rest')
  accepted(ready, { type: 'beginEncounter' })
  const fresh = ready.entities.find(e => e.ai)!
  fresh.pos = { x: p.pos.x + 1, z: p.pos.z }
  expect(run(ready, 24).filter(e => e.type === 'damage' && e.actorId === ready.playerId)).toEqual([])
})

it('R04 replacing an unused tile allocates a new effect id, and restore rejects an invalid owner', () => {
  const w = arena('hearth-frame')
  const owned = () => {
    const effects = Reflect.get(w, 'effects') as { id: number; ownerId: number }[] | undefined
    expect(effects, 'canonical owned footprint table').toBeInstanceOf(Array)
    const tiles = effects!.filter(e => e.ownerId === w.playerId)
    expect(tiles).toHaveLength(1)
    return tiles[0]!
  }
  tap(w, left, 24, east)
  const first = owned()
  tap(w, left, 24, { x: 0, z: 3 })
  const second = owned()
  expect(second.id).toBeGreaterThan(first.id)
  const bytes = serialize(w), bad = JSON.parse(bytes)
  expect(serialize(restore(bytes))).toBe(bytes)
  bad.world.effects.find((e: { id: number }) => e.id === second.id).ownerId = w.nextId + 100
  expect(() => restore(JSON.stringify(bad))).toThrow()
})
