import { expect } from 'vitest'
import { contentSchema } from '../../../content/schema'
import { Button, createWorld, IDLE_COMMAND, previewAction, rngFloat, spawnEntity, step } from '../../core'
import type { ActionDefinition, ActionPreview, CombatContent, DamageValues, Entity, FoldDefinition, Operation, QueryResult, SimEvent, StatModifier, World } from '../../core'

export const zero = (): DamageValues => ({ weight: 0, heat: 0, gale: 0 })
export const mod = (id: string, kind: 'boost' | 'multiplier', value: number, requiredTags: StatModifier['requiredTags'] = [], types: StatModifier['types'] = []): StatModifier => ({ id, kind, value, requiredTags, types })
export const flat = (id: string, damageType: keyof DamageValues, value: number, requiredTags: StatModifier['requiredTags'] = []): StatModifier => ({ id, kind: 'flat', damageType, value, requiredTags, types: [] })
export const conversion = (id: string, from: 'weight' | 'heat', to: 'heat' | 'gale', value: number): StatModifier => ({ id, kind: 'conversion', from, to, value, requiredTags: [], types: [] })
export const utility = (id: string, kind: 'health' | 'healthMultiplier' | 'movement' | 'reach' | 'reachMultiplier' | 'recovery' | 'dodgeRecovery' | 'dodgeCooldown', value: number): StatModifier => ({ id, kind, value, requiredTags: [], types: [] })
export const reduction = (id: string, damageType: keyof DamageValues, value: number): StatModifier => ({ id, kind: 'reduction', damageType, value, requiredTags: [], types: [] })

export const actionCards = [
  ['span-cut', 'Span Cut', 'weapon', 0, 0, 0, 1, 1.7, 100, 6, 3, 12, 0, 0],
  ['fold-dart', 'Fold Dart', 'projectile', 16, 0, 0, 0, 10, 0, 8, 1, 15, 14, .12],
  ['rill-fan', 'Rill Fan', 'area', 0, 0, 18, 0, 3, 70, 12, 1, 20, 0, 0],
  ['plinth-blow', 'Plinth Blow', 'weapon', 0, 0, 0, 1.5, 2.2, 50, 14, 3, 24, 0, 0],
  ['hearth-shard', 'Hearth Shard', 'projectile', 0, 20, 0, 0, 8, 0, 12, 1, 21, 10, .16],
  ['skim-needle', 'Skim Needle', 'projectile', 0, 0, 12, 0, 12, 0, 5, 1, 12, 20, .10],
  ['sill-rake', 'Sill Rake', 'weapon', 0, 0, 0, 1, 2.3, 60, 8, 3, 16, 0, 0],
  ['cairn-wake', 'Cairn Wake', 'area', 10, 10, 0, 0, 2, 360, 16, 1, 25, 0, 0]
] as const

export function actions(): ActionDefinition[] {
  return actionCards.map(([id, name, delivery, weight, heat, gale, weaponCoefficient, reach, angle, w, a, r, speed, radius]) => {
    const common = { id, name, tags: delivery === 'weapon' ? ['weapon', 'melee', 'area'] as const : delivery === 'projectile' ? ['cast', 'projectile'] as const : ['cast', 'area'] as const,
      baseDamage: { weight, heat, gale }, weaponCoefficient, reach, timing: { windupTicks: w, activeTicks: a, recoveryTicks: r, moveCancelTicks: 6 },
      cooldownTicks: 0, damage: weight + heat + gale + 24 * weaponCoefficient, knockback: { speed: 0, ticks: 0 }, impactPauseTicks: 0, hitFlashTicks: 0 }
    return delivery === 'projectile' ? { ...common, tags: [...common.tags], kind: 'projectile', speed, radius, lifetimeTicks: Math.ceil(60 * reach / speed) } :
      { ...common, tags: [...common.tags], kind: 'melee', range: reach, arcRadians: angle * Math.PI / 180 }
  })
}

export function folds(): FoldDefinition[] {
  const make = (id: string, handle: FoldDefinition['handle'], tension: 1 | 2, compatibility: FoldDefinition['compatibility'], patch: Partial<FoldDefinition>): FoldDefinition => ({
    id, name: id.split('-').map(word => word[0]!.toUpperCase() + word.slice(1)).join(' '), handle, tension, compatibility,
    modifiers: [], reachFactor: 1, arcFactor: 1, radiusFactor: 1, windupDelta: 0, recoveryDelta: 0, projectileAngles: [0], ...patch })
  return [
    make('long-pleat', 'reach', 2, 'finite-reach', { reachFactor: 1.5, recoveryDelta: 6, modifiers: [mod('long', 'multiplier', .8)] }),
    make('short-pleat', 'reach', 1, 'finite-reach', { reachFactor: .75, modifiers: [mod('short', 'multiplier', 1.15)] }),
    make('stanch-pleat', 'reach', 1, 'finite-reach', { reachFactor: .85, recoveryDelta: -4 }),
    make('splay-pleat', 'spread', 1, 'single-projectile', { projectileAngles: [-18, 0, 18], modifiers: [mod('splay', 'multiplier', .45)] }),
    make('close-pleat', 'spread', 1, 'melee-sector', { arcFactor: .7, modifiers: [mod('close', 'multiplier', 1.2)] }),
    make('broad-pleat', 'spread', 1, 'sector', { arcFactor: 1.4, modifiers: [mod('broad', 'multiplier', .8)] }),
    make('fine-pleat', 'spread', 1, 'single-projectile', { radiusFactor: .6, modifiers: [mod('fine', 'multiplier', 1.15)] }),
    make('kiln-pleat', 'material', 2, 'positive-weight', { recoveryDelta: 6, modifiers: [conversion('kiln', 'weight', 'heat', .4)] }),
    make('vane-pleat', 'material', 2, 'positive-weight', { reachFactor: .85, modifiers: [conversion('vane', 'weight', 'gale', .4)] }),
    make('draft-pleat', 'material', 2, 'positive-heat', { modifiers: [conversion('draft', 'heat', 'gale', .5), mod('draft-price', 'multiplier', .9)] }),
    make('ballast-pleat', 'material', 1, 'any', { windupDelta: 4, modifiers: [flat('ballast', 'weight', 8)] }),
    make('hush-pleat', 'material', 1, 'any', { recoveryDelta: 6, modifiers: [flat('hush', 'gale', 8)] })
  ]
}

export function neutralContent(): CombatContent {
  const cards = actions()
  const roles = ['weapon', 'offhand', 'coat', 'boots', 'survey-tally'] as const
  return contentSchema.parse({ skills: [], enemies: [{ id: 'creaseback', maxHealth: 72, radius: .45, moveSpeed: 0, acquireRange: 0, attackRange: 0, skillId: 'span-cut', deathTicks: 30 }],
    dodge: { timing: { windupTicks: 0, activeTicks: 10, recoveryTicks: 8, moveCancelTicks: 8 }, distance: 3, cooldownTicks: 30, invulnerableFrom: 2, invulnerableUntil: 8 },
    m2: { version: 'qa-v1', actions: cards, folds: folds(), graphProfiles: [{ id: 'qa-graph', version: 1, radius: 7,
      families: Array.from({ length: 6 }, (_, i) => ({ id: `family-${i}`, name: `Family ${i}`, modifiers: [mod(`family-${i}`, 'boost', .05, [], ['weight'])] })),
      bargains: Array.from({ length: 6 }, (_, orientation) => ({ orientation,
        rhombus: [mod(`rhombus-${orientation}`, 'multiplier', 1.1, ['melee']), { ...utility(`rhombus-price-${orientation}`, 'reachMultiplier', .9), requiredTags: ['projectile'] }],
        hexagon: [mod(`hexagon-${orientation}`, 'multiplier', 1.15, ['melee']), { ...utility(`hexagon-price-${orientation}`, 'reachMultiplier', .9), requiredTags: ['projectile'] }] })) }],
      itemBases: roles.map(role => ({ id: `qa-${role}`, name: `QA ${role}`, role, starter: true, weaponDamage: { ...zero(), weight: role === 'weapon' ? 24 : 0 }, modifiers: [] })),
      affixes: [
        { id: 'qa-coat-boost', name: 'QA coat boost', category: 'offensive', roles: ['coat'], modifier: mod('qa-coat-boost', 'boost', 0), valuePerPoint: .01,
          tiers: [{ tier: 1, min: 4, max: 6, unlockRank: 1 }, { tier: 2, min: 7, max: 9, unlockRank: 5 }, { tier: 3, min: 10, max: 12, unlockRank: 10 }] },
        { id: 'qa-cast-flat', name: 'QA cast flat', category: 'offensive', roles: ['survey-tally'], modifier: flat('qa-cast-flat', 'gale', 0, ['cast']), valuePerPoint: 1,
          tiers: [{ tier: 1, min: 2, max: 3, unlockRank: 1 }, { tier: 2, min: 4, max: 5, unlockRank: 5 }, { tier: 3, min: 6, max: 8, unlockRank: 10 }] },
        { id: 'qa-reach', name: 'QA projectile reach', category: 'utility', roles: ['survey-tally'], modifier: { ...utility('qa-reach', 'reach', 0), requiredTags: ['projectile'] }, valuePerPoint: .01,
          tiers: [{ tier: 1, min: 4, max: 6, unlockRank: 1 }, { tier: 2, min: 7, max: 9, unlockRank: 5 }, { tier: 3, min: 10, max: 12, unlockRank: 10 }] },
        { id: 'qa-flat', name: 'QA weight', category: 'offensive', roles: ['weapon'], modifier: flat('qa-flat', 'weight', 0, ['weapon']), valuePerPoint: 1,
          tiers: [{ tier: 1, min: 4, max: 6, unlockRank: 1 }, { tier: 2, min: 7, max: 10, unlockRank: 5 }, { tier: 3, min: 11, max: 14, unlockRank: 10 }] },
        { id: 'qa-health', name: 'QA health', category: 'utility', roles: roles.filter(role => role !== 'survey-tally'), modifier: utility('qa-health', 'health', 0), valuePerPoint: 1,
          tiers: [{ tier: 1, min: 8, max: 12, unlockRank: 1 }, { tier: 2, min: 13, max: 18, unlockRank: 5 }, { tier: 3, min: 19, max: 26, unlockRank: 10 }] }
      ],
      lootTables: [{ id: 'qa-loot', dropChance: .5, roles: roles.map(role => ({ role, weight: 1 })), rarities: [{ categories: [], weight: .5 }, { categories: ['offensive'], weight: .35 }, { categories: ['offensive', 'utility'], weight: .15 }], tiers: [{ tier: 1, weight: .7, unlockRank: 1 }, { tier: 2, weight: .25, unlockRank: 5 }, { tier: 3, weight: .05, unlockRank: 10 }] }] } })
}

/** Unsupported baseline calls are assertions, never test setup exceptions. */
export function succeeds<T>(label: string, call: () => T): T {
  let result: T | undefined
  let error: unknown
  try { result = call() } catch (caught) { error = caught }
  expect(error, `${label}: ${String(error ?? '')}`).toBeUndefined()
  return result!
}
export function value<T>(result: QueryResult<T>): T {
  expect(result, 'public query must support this M2 behaviour').toMatchObject({ ok: true })
  return (result as { ok: true; value: T }).value
}
export function fixture(content = neutralContent(), rest = false) {
  const world = createWorld(7, undefined, content)
  rngFloat(world, 'loot')
  const player = spawnEntity(world, { kind: 'player', pos: { x: 0, z: 0 }, radius: .32, health: 120, maxHealth: 120,
    skills: { primary: 'span-cut', secondary: 'fold-dart' } })
  player.character = { rank: 1, xp: 0, points: 4, graph: { profileId: 'qa-graph', version: 1, seed: 7, allocations: [], activeShapes: [] },
    items: [{ id: 1, baseId: 'qa-weapon', role: 'weapon', affixes: [] }], equipment: { weapon: 1, offhand: null, coat: null, boots: null, 'survey-tally': null }, inventory: [], stash: [],
    loadout: ['span-cut', 'fold-dart', 'rill-fan', 'hearth-shard', 'skim-needle', 'cairn-wake'], folds: {} }
  world.nextItemId = 2
  world.encounter = { id: 'qa-clearing', phase: rest ? 'rest' : 'active', attempt: 1, rewardedIds: [] }
  return { world, player }
}
export function target(world: World, health = 1000, pos = { x: 1, z: 0 }, extra: Partial<Entity> = {}) {
  return spawnEntity(world, { kind: 'target', pos, radius: .25, faction: 'enemy', health, maxHealth: health, ...extra })
}
export function tick(world: World, command = IDLE_COMMAND): SimEvent[] { return succeeds('step', () => step(world, command)) }
export function ticks(world: World, count: number, command = IDLE_COMMAND): SimEvent[] {
  return Array.from({ length: count }, () => tick(world, command)).flat()
}
export function edit(world: World, operation: Operation, reason = 'ok') {
  const events = tick(world, { ...IDLE_COMMAND, operations: [operation] })
  expect(events.find(event => event.type.startsWith('operation'))).toMatchObject({ type: reason === 'ok' ? 'operationAccepted' : 'operationRejected', reason, operation, index: 0 })
  return events
}
export function preview(world: World, actor: Entity, skillId: string, victim: Entity): ActionPreview {
  return value(previewAction(world, actor.id, skillId, victim.id))
}
export function hit(world: World, player: Entity, victim: Entity, skillId = 'span-cut') {
  const slot = player.character!.loadout.indexOf(skillId)
  expect(slot, 'fixture action occupies a public loadout slot').toBeGreaterThanOrEqual(0)
  const button = [Button.Primary, Button.Secondary, Button.Skill1, Button.Skill2, Button.Skill3, Button.Skill4][slot]!
  const events = tick(world, { ...IDLE_COMMAND, aim: victim.pos, buttons: button })
  for (let i = 0; i < 180 && !events.some(event => event.type === 'damage' && event.targetId === victim.id); i++) events.push(...tick(world))
  return events.filter((event): event is Extract<SimEvent, { type: 'damage' }> => event.type === 'damage' && event.targetId === victim.id)
}
