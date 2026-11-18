import { rngInt } from '../core/rng'
import { DAMAGE_TYPES, EQUIPMENT_ROLES, GAIT } from '../core/types'
import type { ActionTag, ActionTiming, CharacterState, DamageValues, Entity, GraphProfile, StatInspection, StatModifier, World } from '../core/types'

export const zeroDamage = (): DamageValues => ({ weight: 0, heat: 0, gale: 0 })
export const byId = (a: { id: string }, b: { id: string }) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0
export const roundAtLeastOne = (value: number) => Math.max(1, Math.floor(value + .5))
export function recoveryTiming(base: ActionTiming, delta: number) {
  const recoveryTicks = roundAtLeastOne(base.recoveryTicks + delta)
  return { ...base, recoveryTicks, moveCancelTicks: Math.min(recoveryTicks, roundAtLeastOne(base.moveCancelTicks + delta)) }
}

export function sumStat(modifiers: StatModifier[], kind: StatModifier['kind']): number {
  return modifiers.reduce((sum, mod) => mod.kind === kind ? sum + mod.value : sum, 0)
}

export function productStat(modifiers: StatModifier[], kind: StatModifier['kind']): number {
  return modifiers.reduce((product, mod) => mod.kind === kind ? product * mod.value : product, 1)
}

/** Rotate an axial coordinate into the first sixty-degree sector, including its starting axis. */
function sector(node: string): number {
  let [i, j] = node.split(',').map(Number) as [number, number]
  for (let index = 0; index < 6; index++) {
    if (i > 0 && j >= 0) return index
    ;[i, j] = [i + j, -i]
  }
  throw new RangeError('Invalid paid node ' + node)
}

function sectorFamilies(world: World, profile: GraphProfile, seed: number) {
  const families = [...profile.families].sort(byId)
  const local = { ...world, seed, rng: {} }
  const stream = 'graph:' + profile.id + ':' + profile.version
  for (let i = families.length - 1; i > 0; i--) {
    const j = rngInt(local, stream, i + 1)
    ;[families[i], families[j]] = [families[j]!, families[i]!]
  }
  return families
}

type Source = StatInspection['sources'][number]

export function modifierSource(id: string, label: string, modifiers: StatModifier[]): Source {
  return { id, label, modifiers: modifiers.map(mod => ({
    ...mod, id: id + '/' + mod.id, types: [...mod.types], requiredTags: [...mod.requiredTags]
  })).sort(byId) }
}

function buildSources(world: World, character: CharacterState): Source[] {
  const content = world.content.m2!
  const sources: Source[] = []
  for (const role of EQUIPMENT_ROLES) {
    const item = character.items.find(item => item.id === character.equipment[role])
    if (!item) continue
    const base = content.itemBases.find(base => base.id === item.baseId)!
    const id = 'item/' + item.id
    sources.push(modifierSource(id + '/base', base.name, base.modifiers))
    for (const affix of item.affixes) {
      const family = content.affixes.find(family => family.id === affix.familyId)!
      sources.push(modifierSource(id + '/affix/' + family.id, family.name,
        [{ ...family.modifier, value: affix.roll * family.valuePerPoint }]))
    }
  }
  const graph = character.graph
  const profile = content.graphProfiles.find(profile => profile.id === graph.profileId && profile.version === graph.version)!
  if (graph.allocations.length) {
    const families = sectorFamilies(world, profile, graph.seed)
    for (const node of graph.allocations) {
      const family = families[sector(node)]!
      sources.push(modifierSource('node/' + node, family.name, family.modifiers))
    }
  }
  for (const shape of graph.activeShapes) {
    const [kind, orientation] = shape.split('-')
    const bargain = profile.bargains.find(bargain => bargain.orientation === Number(orientation))!
    sources.push(modifierSource('shape/' + shape, shape, kind === 'rhombus' ? bargain.rhombus : bargain.hexagon))
  }
  return sources
}

export function baseMovementSpeed(world: World, actor: Entity): number {
  if (actor.id === world.playerId) return GAIT.runSpeed
  return actor.ai ? world.content.enemies.find(enemy => enemy.id === actor.ai!.enemyId)!.moveSpeed : 1
}

export function actorStats(world: World, actor: Entity, incomingTags: ActionTag[] = []): StatInspection {
  const sources = actor.character ? buildSources(world, actor.character) : []
  let burden = 1
  for (const ailment of world.ailments) {
    if (ailment.targetId !== actor.id) continue
    if (ailment.id === 'burden') {
      burden = .85
      sources.push({ id: 'ailment/burden', label: 'Burden (movement ×0.85)', modifiers: [] })
    }
    if (ailment.id === 'draftbind') sources.push(modifierSource('ailment/draftbind', 'Draftbind',
      [{ id: 'damage', kind: 'multiplier', value: .9, types: [], requiredTags: [] }]))
  }
  sources.sort(byId)
  const modifiers = sources.flatMap(source => source.modifiers).sort(byId)
  const mods = modifiers.filter(mod => !mod.requiredTags.length)
  const reductions = zeroDamage()
  for (const mod of modifiers) {
    if (mod.kind === 'reduction' && mod.requiredTags.every(tag => incomingTags.includes(tag)) &&
      (!mod.types.length || mod.types.includes(mod.damageType))) reductions[mod.damageType] += mod.value
  }
  for (const type of DAMAGE_TYPES) reductions[type] = Math.min(.75, Math.max(0, reductions[type]))
  const dodge = world.content.dodge
  return { actorId: actor.id, sources, reductions,
    maxHealth: actor.character ? roundAtLeastOne((120 + sumStat(mods, 'health')) * productStat(mods, 'healthMultiplier')) : actor.maxHealth,
    movementSpeed: baseMovementSpeed(world, actor) * Math.max(0, 1 + Math.min(.3, sumStat(mods, 'movement'))) * burden,
    dodge: { ...dodge, cooldownTicks: roundAtLeastOne(dodge.cooldownTicks + sumStat(mods, 'dodgeCooldown')),
      timing: recoveryTiming(dodge.timing, sumStat(mods, 'dodgeRecovery')) } }
}
