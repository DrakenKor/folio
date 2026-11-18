import { m1Content, WINDSTEP_CLEARING } from '../content/m1'
import { m2Content } from '../content/m2'
import { fmath } from './core/fmath'
import { rngFloat } from './core/rng'
import { createWorld, spawnEntity } from './core/store'
import { M2_SCENARIO_NAMES, SCENARIO_NAMES, SIM_BUILD } from './core/types'
import type { CharacterState, Entity, Loadout, RolledItem, SimEvent, Vec2, World } from './core/types'
import { UnsupportedError } from './core/unsupported'

export { SCENARIO_NAMES, SIM_BUILD } from './core/types'

/** Derive encounter outcome without storing presentation or intermediate wave victory. */
export function encounterOutcome(world: World, scenario: string): 'ongoing' | 'victory' | 'defeat' {
  const player = world.entities.find(actor => actor.id === world.playerId)
  if (!player || player.death) return 'defeat'
  if (scenario === 'm1-fight') return world.tick >= WINDSTEP_CLEARING.fightTicks ? 'victory' : 'ongoing'
  return world.entities.some(actor => actor.ai && !actor.death) ? 'ongoing' : 'victory'
}

export function spawnCreaseback(world: World, pos: Vec2): Entity {
  const enemy = world.content.enemies.find(value => value.id === 'creaseback')!
  return spawnEntity(world, {
    kind: enemy.id, faction: 'creasebacks', pos, radius: enemy.radius,
    maxHealth: enemy.maxHealth, health: enemy.maxHealth, facing: Math.PI, aim: Math.PI,
    skills: { primary: enemy.skillId, secondary: null },
    ai: { enemyId: enemy.id, phase: 'idle', ageTicks: 0, targetId: null }
  })
}

/** Publish scheduled trios after combat at ticks 600..6600; corpses also block a wave. */
export function spawnFightWave(world: World): SimEvent[] {
  if (world.tick === 0 || world.tick >= WINDSTEP_CLEARING.fightTicks ||
    world.tick % WINDSTEP_CLEARING.waveTicks !== 0 ||
    world.entities.some(actor => actor.ai?.enemyId === 'creaseback') ||
    !world.entities.some(actor => actor.id === world.playerId && !actor.death)) return []
  return WINDSTEP_CLEARING.enemies.map(pos => {
    const actor = spawnCreaseback(world, pos)
    return { type: 'spawn', tick: world.tick, id: actor.id, kind: actor.kind }
  })
}

function buildM1(world: World, name: string): World {
  world.arena = structuredClone(WINDSTEP_CLEARING.arena)
  const player = spawnEntity(world, {
    kind: 'player', ...WINDSTEP_CLEARING.player, health: WINDSTEP_CLEARING.player.maxHealth,
    skills: { primary: 'span-cut', secondary: 'fold-dart' }
  })
  const positions = name === 'm1-stress' ? Array.from({ length: 12 }, (_, i) => ({
    x: 1 + i % 4, z: (Math.floor(i / 4) - 1) * 2
  })) : WINDSTEP_CLEARING.enemies
  for (const pos of positions) spawnCreaseback(world, pos)
  if (name === 'm1-stress') {
    const skill = world.content.skills.find(value => value.id === 'fold-dart')!
    if (skill.kind !== 'projectile') throw new TypeError('Stress fixture requires Fold Dart')
    for (let i = 0; i < 16; i++) {
      const angle = i * 2 * Math.PI / 16
      world.projectiles.push({
        id: world.nextId++, ownerId: player.id, faction: player.faction, skillId: skill.id, actionStartTick: 0,
        pos: { ...player.pos }, vel: { x: fmath.cos(angle) * skill.speed, z: fmath.sin(angle) * skill.speed },
        ageTicks: 0, lifetimeTicks: skill.lifetimeTicks, radius: skill.radius, damage: skill.damage,
        knockback: { ...skill.knockback }, impactPauseTicks: skill.impactPauseTicks, hitFlashTicks: skill.hitFlashTicks
      })
    }
  }
  return world
}

function buildM2Clearing(seed: number): World {
  const world = createWorld(seed, SIM_BUILD, m2Content())
  const content = world.content.m2!
  const profile = content.graphProfiles[0]!
  const starterBases = content.itemBases.filter(base => base.starter)
  const items: RolledItem[] = starterBases.map(base => ({ id: world.nextItemId++, baseId: base.id, role: base.role, affixes: [] }))
  const equipment = Object.fromEntries(items.map(item => [item.role, item.id])) as CharacterState['equipment']
  const loadout: Loadout = ['span-cut', 'fold-dart', 'rill-fan', 'plinth-blow', 'hearth-shard', 'skim-needle']
  const maxHealth = starterBases.flatMap(base => base.modifiers).reduce<number>((health, modifier) =>
    health + (modifier.kind === 'health' ? modifier.value : 0), WINDSTEP_CLEARING.player.maxHealth)

  world.scenario = 'm2-clearing'
  world.arena = structuredClone(WINDSTEP_CLEARING.arena)
  world.encounter = { id: 'm2-clearing', phase: 'rest', attempt: 0, rewardedIds: [] }
  // Initialise the saved loot stream using the same first draw as the M2 fixtures.
  rngFloat(world, 'loot')
  spawnEntity(world, {
    kind: 'player', ...WINDSTEP_CLEARING.player, health: maxHealth, maxHealth,
    skills: { primary: loadout[0], secondary: loadout[1] },
    character: {
      rank: 1, xp: 0, points: 4, graph: { profileId: profile.id, seed, version: profile.version, allocations: [], activeShapes: [] },
      equipment, items, inventory: [], stash: [], loadout, folds: {}
    }
  })
  return world
}

/** Build a fresh deterministic fixture without ambient state or presentation data. */
export function buildScenario(name: string, seed: number): World {
  if (name === 'm2-clearing') return buildM2Clearing(seed)
  if (M2_SCENARIO_NAMES.some(scenario => scenario === name)) throw new UnsupportedError('M2 scenarios (T2.3)')
  const scenario = SCENARIO_NAMES.find(candidate => candidate === name)
  if (!scenario) throw new RangeError(`Unknown scenario: ${name}`)
  const world = createWorld(seed, SIM_BUILD, name.startsWith('m1-') ? m1Content() : undefined)
  world.scenario = scenario
  if (name.startsWith('m1-')) return buildM1(world, name)
  if (name === 'empty') return world
  spawnEntity(world, { kind: 'player', pos: { x: 0, z: 0 }, radius: 0.4 })
  const count = name === 'meadow-start' ? 12 : 1000
  const columns = name === 'meadow-start' ? 4 : 32
  for (let i = 0; i < count; i++) {
    spawnEntity(world, {
      kind: 'dummy', radius: 0.4,
      pos: {
        x: 4 + (i % columns) * 2 + rngFloat(world, 'scenario') * 0.5,
        z: (Math.floor(i / columns) - Math.floor(count / columns) / 2) * 2 + rngFloat(world, 'scenario') * 0.5
      }
    })
  }
  return world
}
