import { createWorld, restore, serialize, spawnEntity, step } from '../core'
import { IDLE_COMMAND } from '../core/types'
import type { CombatContent, Command, Entity, Projectile, SimEvent, SkillDefinition, Vec2, World } from '../core/types'

/** Neutral mechanics, independent of authored content and enemy AI. */
export function neutralContent(): CombatContent {
  const shared = {
    timing: { windupTicks: 2, activeTicks: 2, recoveryTicks: 3, moveCancelTicks: 1 },
    cooldownTicks: 0, knockback: { speed: 0, ticks: 0 }, impactPauseTicks: 0, hitFlashTicks: 0
  }
  return {
    skills: [
      { ...structuredClone(shared), id: 'fixture-melee', kind: 'melee', damage: 7, range: 2, arcRadians: Math.PI / 2 },
      { ...structuredClone(shared), id: 'fixture-projectile', kind: 'projectile', damage: 5, speed: 30, radius: 0.1, lifetimeTicks: 12 }
    ],
    enemies: [],
    dodge: {
      timing: { windupTicks: 0, activeTicks: 4, recoveryTicks: 3, moveCancelTicks: 3 },
      distance: 1.2, cooldownTicks: 12, invulnerableFrom: 1, invulnerableUntil: 3
    }
  }
}

/** Approved M1 values, built locally rather than importing future T1.5 content. */
export function m1Content(): CombatContent {
  const impact = { cooldownTicks: 0, impactPauseTicks: 2, hitFlashTicks: 6 }
  return {
    skills: [
      {
        ...impact, id: 'creaseback-strike', kind: 'melee', damage: 20, range: 1.4, arcRadians: 70 * Math.PI / 180,
        timing: { windupTicks: 24, activeTicks: 3, recoveryTicks: 24, moveCancelTicks: 24 },
        knockback: { speed: 0.15 * 60 / 4, ticks: 4 }
      },
      {
        ...impact, id: 'fold-dart', kind: 'projectile', damage: 16, speed: 14, radius: 0.12, lifetimeTicks: 43,
        timing: { windupTicks: 8, activeTicks: 1, recoveryTicks: 15, moveCancelTicks: 6 },
        knockback: { speed: 0.25 * 60 / 4, ticks: 4 }
      },
      {
        ...impact, id: 'span-cut', kind: 'melee', damage: 24, range: 1.7, arcRadians: 100 * Math.PI / 180,
        timing: { windupTicks: 6, activeTicks: 3, recoveryTicks: 12, moveCancelTicks: 6 },
        knockback: { speed: 0.25 * 60 / 4, ticks: 4 }
      }
    ],
    enemies: [{ id: 'creaseback', maxHealth: 72, radius: 0.45, moveSpeed: 1.8, acquireRange: 8, attackRange: 1.2, skillId: 'creaseback-strike', deathTicks: 30 }],
    dodge: {
      timing: { windupTicks: 0, activeTicks: 10, recoveryTicks: 8, moveCancelTicks: 8 },
      distance: 3, cooldownTicks: 30, invulnerableFrom: 2, invulnerableUntil: 8
    }
  }
}

export function fixture(content = neutralContent(), overrides: Partial<Entity> = {}) {
  const initial = createWorld(7)
  initial.content = content
  spawnEntity(initial, {
    kind: 'player', pos: { x: 0, z: 0 }, radius: 0.32, maxHealth: 120, health: 120,
    skills: {
      primary: (content.skills.find(skill => skill.id === 'span-cut') ?? content.skills.find(skill => skill.kind === 'melee'))!.id,
      secondary: content.skills.find(skill => skill.kind === 'projectile')!.id
    },
    ...overrides
  })
  const world = restore(serialize(initial))
  return { world, player: world.entities[0]! }
}

export function target(world: World, pos: Vec2 = { x: 1.2, z: 0 }, overrides: Partial<Entity> = {}): Entity {
  return spawnEntity(world, {
    kind: 'fixture-target', faction: 'hostile', pos, radius: 0.45, maxHealth: 72, health: 72, ai: null, ...overrides
  })
}

export function command(buttons = 0, move: Vec2 = { x: 0, z: 0 }, aim: Vec2 | null = { x: 100, z: 0 }): Command {
  return { buttons, move, aim }
}

export function advance(world: World, ticks: number, input: Command = IDLE_COMMAND): SimEvent[] {
  const events: SimEvent[] = []
  for (let i = 0; i < ticks; i++) events.push(...step(world, input))
  return events
}

export function projectile(world: World, owner: Entity, overrides: Partial<Projectile> = {}): Projectile {
  const skill = world.content.skills.find(skill => skill.kind === 'projectile')! as Extract<SkillDefinition, { kind: 'projectile' }>
  const shot: Projectile = {
    id: world.nextId++, ownerId: owner.id, faction: owner.faction, skillId: skill.id, actionStartTick: world.tick,
    pos: { ...owner.pos }, vel: { x: skill.speed, z: 0 }, radius: skill.radius,
    ageTicks: 0, lifetimeTicks: skill.lifetimeTicks, damage: skill.damage,
    knockback: { ...skill.knockback }, impactPauseTicks: skill.impactPauseTicks, hitFlashTicks: skill.hitFlashTicks,
    ...overrides
  }
  world.projectiles.push(shot)
  return shot
}

export function incoming(world: World, victim: Entity, overrides: Partial<Projectile> = {}): Projectile {
  const owner = target(world, { x: victim.pos.x - 4, z: victim.pos.z })
  return projectile(world, owner, {
    pos: { x: victim.pos.x - 1, z: victim.pos.z }, vel: { x: 120, z: 0 }, ...overrides
  })
}

export const contentCases = [
  { name: 'neutral', build: neutralContent }, { name: 'M1', build: m1Content }
]
