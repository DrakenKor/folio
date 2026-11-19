import { expect } from 'vitest'
import { Button, createWorld, IDLE_COMMAND, spawnEntity, step } from '../../core'
import type { ActionDefinition, ActionTag, Command, Entity, FoldDefinition, Operation, SimEvent, World } from '../../core'
export { clearing } from '../../../../scenarios/m3a-profile'
import { fixture, neutralContent, succeeds } from '../m2/fixtures'

export const families = {
  hemblade: ['span-cut', 'open-hem'],
  plumbshoe: ['plinth-blow', 'brace-mark'],
  'verge-reel': ['cast-loop', 'gather-line'],
  'hearth-frame': ['lay-bed', 'lift-print']
} as const
export type Family = keyof typeof families
export const casts = ['fold-dart', 'rill-fan'] as const
export const cards = [
  ['span-cut', 1, 1.7, 100, 6, 3, 12],
  ['open-hem', 1.5, 2.4, 0, 4, 6, 16],
  ['plinth-blow', 1, 1.4, 360, 4, 1, 20],
  ['brace-mark', 1, 2, 180, 3, 10, 18],
  ['cast-loop', .75, 7, 0, 5, 1, 10],
  ['gather-line', 1, 7, 0, 2, 1, 10],
  ['lay-bed', .5, 4, 0, 6, 1, 12],
  ['lift-print', .75, 5, 0, 5, 1, 14],
  ['fold-dart', 0, 10, 0, 8, 1, 15],
  ['rill-fan', 0, 4, 0, 6, 1, 18]
] as const
export const pleats = [
  ['splay', 'spread', 1, ['fold-dart']],
  ['through', 'reach', 2, ['fold-dart', 'lift-print']],
  ['after', 'material', 2, ['span-cut', 'plinth-blow', 'brace-mark']],
  ['hinge', 'reach', 2, ['cast-loop', 'open-hem']],
  ['rim', 'spread', 1, ['lay-bed', 'rill-fan']],
  ['catch', 'material', 1, ['gather-line', 'lay-bed', 'lift-print']]
] as const
export const buttons = [Button.Primary, Button.Secondary, Button.Skill1, Button.Skill2, Button.Skill3, Button.Skill4] as const
export const origin = { x: 0, z: 0 }
export const east = { x: 4, z: 0 }
export const command = (buttons = 0, aim = east, move = origin): Command => ({ move, aim, buttons })
export const playerOf = (w: World) => w.entities.find(e => e.id === w.playerId)!
export const char = (w: World) => playerOf(w).character!

export const refit = (familyId: Family) => ({ type: 'refitWeapon', familyId } as unknown as Operation)
export function operate(w: World, edit: Operation) {
  return succeeds('recorded ' + edit.type, () => step(w, { ...IDLE_COMMAND, operations: [edit] }))
    .find(e => e.type === 'operationAccepted' || e.type === 'operationRejected')
}
export function accepted(w: World, edit: Operation) {
  expect(operate(w, edit), JSON.stringify(edit)).toMatchObject({ type: 'operationAccepted', reason: 'ok' })
}
// Parameters additional to the public M2 phase/geometry fields. The mechanic discriminant selects the drawing.
const mechanics = {
  'span-cut': { maxSeams: 2, refreshTicks: 120 }, 'open-hem': { seamCost: 2, stepTicks: 6, halfWidth: .45 },
  'plinth-blow': { chargedAt: 24, autoReleaseAt: 45, chargedCoefficient: 1.75, rootTicks: 24 },
  'brace-mark': { incomingFactor: .5, answerReach: 2, answerRadius: .8 },
  'cast-loop': { eyeLifetime: 150 }, 'gather-line': { stitchFactor: .5, stitchReach: 2 },
  'lay-bed': { radius: .9, armTicks: 18, expiryTicks: 180 }, 'lift-print': { halfWidth: .35, impressionHeat: 16, impressionRadius: 1.5 },
  'fold-dart': {}, 'rill-fan': { halfWidth: .6, pulseTicks: 15, maxPulses: 4, maxTurnDegrees: 15 }
}
const foldParameters = {
  splay: { angles: [-18, 0, 18], primaryFactor: .45 }, through: { maxContacts: 2, primaryFactor: .7 },
  after: { delayTicks: 18, primaryFactor: .5, echoFactor: .5 }, hinge: { retraceFraction: .5, primaryFactor: .75, returnFactor: .5 },
  rim: { offset: .8, tileRadius: .6, laneHalfWidth: .3, primaryFactor: .75 },
  catch: { delayTicks: 12, radius: .8, expiryTicks: 60, primaryFactor: .8, entrantFactor: .5 }
}
export function neutralCard([id, weaponCoefficient, reach, angle, windupTicks, activeTicks, recoveryTicks]: readonly [typeof cards[number][0], number, number, number, number, number, number]): ActionDefinition {
  const projectile = ['cast-loop', 'gather-line', 'fold-dart'].includes(id)
  const tags: ActionTag[] = casts.some(c => c === id) ? ['cast'] : ['weapon']
  if (['span-cut', 'open-hem', 'plinth-blow', 'brace-mark'].includes(id)) tags.push('melee')
  tags.push(projectile ? 'projectile' : 'area')
  const baseDamage = { weight: id === 'fold-dart' ? 16 : 0, heat: id === 'lay-bed' ? 16 : 0, gale: id === 'rill-fan' ? 16 : 0 }
  const familyId = Object.entries(families).find(([, pair]) => pair.some(s => s === id))?.[0] ?? 'survey-tally'
  const common = {
    id, name: id, mechanic: { kind: id, ...mechanics[id] }, familyId, weaponCoefficient, reach, tags, baseDamage,
    timing: { windupTicks, activeTicks, recoveryTicks, moveCancelTicks: recoveryTicks },
    damage: weaponCoefficient * 24 + Object.values(baseDamage).reduce((a, b) => a + b), cooldownTicks: 0,
    impactPauseTicks: 0, hitFlashTicks: 0, knockback: { speed: 0, ticks: 0 }
  }
  const speed = id === 'cast-loop' ? 10 : 14
  return projectile ? { ...common, kind: 'projectile', speed, radius: id === 'fold-dart' ? .12 : id === 'cast-loop' ? .16 : .2, lifetimeTicks: Math.ceil(60 * reach / speed) }
    : { ...common, kind: 'melee', range: reach, arcRadians: (angle || 180) * Math.PI / 180 }
}

/** Neutral M3 mechanics with deterministic geometry, no enemy AI, pause or knockback. */
export function arena(family: Family = 'hemblade', folds: Record<string, string[]> = {}) {
  const content = neutralContent(), profile = content.m2!
  profile.version = 'm3-v1'
  profile.actions = cards.map(neutralCard)
  content.skills.push({
    id: 'qa-bolt', kind: 'projectile', timing: { windupTicks: 1, activeTicks: 1, recoveryTicks: 1, moveCancelTicks: 1 },
    cooldownTicks: 0, damage: 31, speed: 12, radius: .02, lifetimeTicks: 180, knockback: { speed: 6, ticks: 4 }, impactPauseTicks: 0, hitFlashTicks: 0
  })
  profile.folds = pleats.map(([name, handle, tension, whitelist]): FoldDefinition => {
    const card = {
      id: name + '-pleat', name, mechanic: { kind: name, ...foldParameters[name] }, whitelist: [...whitelist], handle, tension,
      compatibility: 'any' as const, modifiers: [], reachFactor: 1, arcFactor: 1, radiusFactor: 1, windupDelta: 0, recoveryDelta: 0,
      projectileAngles: name === 'splay' ? [-18, 0, 18] : [0]
    }
    return card
  })
  const weapon = profile.itemBases.find(b => b.role === 'weapon')!
  profile.itemBases = [...profile.itemBases.filter(b => b !== weapon), ...Object.keys(families).map(familyId => ({
    ...weapon, id: familyId === 'hemblade' ? 'shortblade' : familyId, familyId, starter: familyId === 'hemblade'
  }))]
  profile.itemBases.find(b => b.role === 'survey-tally')!.modifiers = [{ id: 'tally-flat', kind: 'flat', requiredTags: ['cast'], types: [], damageType: 'weight', value: 2 }]
  // Probe version dispatch without registering a scenario. At A0 the legacy engine can still step the neutral data.
  const m3 = { skills: content.skills, enemies: content.enemies, dodge: content.dodge, m3: profile }
  const dispatch = succeeds('public M3 profile selection', () => createWorld(7, undefined, { ...m3, enemies: [] }))
  const { world, player } = succeeds('neutral drawing fixture', () => fixture(dispatch.schema === 5 ? m3 : content))
  const c = char(world)
  c.items[0]!.baseId = family === 'hemblade' ? 'shortblade' : family
  c.items.push({ id: world.nextItemId++, baseId: 'qa-survey-tally', role: 'survey-tally', affixes: [] })
  c.equipment['survey-tally'] = 2
  c.loadout = [...families[family], ...casts, null, null]
  c.folds = structuredClone(folds)
  player.skills = { primary: c.loadout[0], secondary: c.loadout[1] }
  return world
}
export function target(w: World, x: number, z = 0, extra: Partial<Entity> = {}) {
  return spawnEntity(w, { kind: 'qa-target', faction: 'hostile', pos: { x, z }, radius: .04, health: 1000, maxHealth: 1000, ...extra })
}
export const run = (w: World, count: number, cmd: Command = command()) =>
  Array.from({ length: count }, () => step(w, cmd)).flat()
export const tap = (w: World, bit: number, tail = 36, aim = east) =>
  [...run(w, 1, command(bit, aim)), ...run(w, tail, command(0, aim))]
export const damage = (events: SimEvent[], targetId?: number) =>
  events.filter((e): e is Extract<SimEvent, { type: 'damage' }> => e.type === 'damage' && (targetId === undefined || e.targetId === targetId))
export const strikes = (events: SimEvent[], skill: string) => damage(events).filter(e => e.skillId === skill)
