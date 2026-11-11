import { BUTTON_MASK, SCENARIO_NAMES } from './types'
import type { ActionTiming, KnockbackSpec, World } from './types'

function check(condition: unknown, field: string): asserts condition {
  if (!condition) throw new TypeError(`Invalid snapshot ${field}`)
}

const integer = (value: number) => Number.isSafeInteger(value) && value >= 0
const positiveInteger = (value: number) => integer(value) && value > 0
const nonnegative = (value: number) => Number.isFinite(value) && value >= 0
const positive = (value: number) => Number.isFinite(value) && value > 0
const text = (value: string) => typeof value === 'string' && value.length > 0
const record = (value: unknown) => !!value && typeof value === 'object' && !Array.isArray(value)
const vector = (value: { x: number; z: number }) => record(value) && Number.isFinite(value.x) && Number.isFinite(value.z)
const buttons = (value: number) => integer(value) && value <= BUTTON_MASK

function timing(value: ActionTiming): boolean {
  return record(value) && integer(value.windupTicks) && positiveInteger(value.activeTicks) &&
    integer(value.recoveryTicks) && integer(value.moveCancelTicks) && value.moveCancelTicks <= value.recoveryTicks &&
    Number.isSafeInteger(value.windupTicks + value.activeTicks + value.recoveryTicks)
}

function knockback(value: KnockbackSpec): boolean {
  return record(value) && nonnegative(value.speed) && integer(value.ticks)
}

/** Validate persisted state without inventing defaults for missing fields. */
export function validateWorld(world: World): void {
  check(record(world) && Number.isSafeInteger(world.seed) && integer(world.tick) && positiveInteger(world.nextId) &&
    Array.isArray(world.entities) && Array.isArray(world.projectiles) && record(world.rng), 'world')
  check(SCENARIO_NAMES.includes(world.scenario), 'scenario')
  const content = world.content
  check(record(content) && Array.isArray(content.skills) && Array.isArray(content.enemies), 'content')
  let previousContentId = ''
  for (const skill of content.skills) {
    check(record(skill) && text(skill.id) && skill.id > previousContentId && skill.id !== 'dodge' && timing(skill.timing) &&
      integer(skill.cooldownTicks) && nonnegative(skill.damage) && knockback(skill.knockback) &&
      integer(skill.impactPauseTicks) && integer(skill.hitFlashTicks), 'skill')
    check(skill.kind === 'melee' ? positive(skill.range) && positive(skill.arcRadians) && skill.arcRadians <= 6.283185307179586 :
      skill.kind === 'projectile' && positive(skill.speed) && nonnegative(skill.radius) && positiveInteger(skill.lifetimeTicks), 'skill geometry')
    previousContentId = skill.id
  }
  previousContentId = ''
  for (const enemy of content.enemies) {
    check(record(enemy) && text(enemy.id) && enemy.id > previousContentId && positive(enemy.maxHealth) &&
      nonnegative(enemy.radius) && nonnegative(enemy.moveSpeed) && nonnegative(enemy.acquireRange) &&
      nonnegative(enemy.attackRange) && enemy.attackRange <= enemy.acquireRange && positiveInteger(enemy.deathTicks) &&
      content.skills.some(skill => skill.id === enemy.skillId), 'enemy definition')
    previousContentId = enemy.id
  }
  const dodge = content.dodge
  check(record(dodge) && timing(dodge.timing) && dodge.timing.windupTicks === 0 && positive(dodge.distance) &&
    positiveInteger(dodge.cooldownTicks) && integer(dodge.invulnerableFrom) && integer(dodge.invulnerableUntil) &&
    dodge.invulnerableFrom < dodge.invulnerableUntil && dodge.invulnerableUntil <= dodge.timing.activeTicks, 'dodge definition')
  check(world.arena === null || (record(world.arena) && vector(world.arena.center) && positive(world.arena.radius)), 'arena')

  let previousId = 0
  const actorIds = new Set(world.entities.map(entity => entity?.id))
  for (const entity of world.entities) {
    check(record(entity) && positiveInteger(entity.id) && entity.id > previousId && entity.id < world.nextId &&
      text(entity.kind) && vector(entity.pos) && vector(entity.vel) && Number.isFinite(entity.facing) && Number.isFinite(entity.aim) &&
      nonnegative(entity.radius) && text(entity.faction), 'entity')
    check(positive(entity.maxHealth) && nonnegative(entity.health) && entity.health <= entity.maxHealth, 'health')
    const death = entity.death
    check(death === null || (record(death) && integer(death.startTick) && death.startTick <= world.tick &&
      integer(death.ageTicks) && death.ageTicks <= world.tick - death.startTick &&
      (death.despawnAfterTicks === null || (positiveInteger(death.despawnAfterTicks) && death.ageTicks < death.despawnAfterTicks))), 'death timer')
    check((entity.health === 0) === (death !== null), 'health/death consistency')
    check(record(entity.skills) && ['primary', 'secondary'].every(slot => {
      const id = entity.skills[slot as keyof typeof entity.skills]
      return id === null || content.skills.some(skill => skill.id === id)
    }), 'skill slots')
    check(record(entity.cooldowns) && integer(entity.cooldowns.primary) && integer(entity.cooldowns.secondary) &&
      integer(entity.cooldowns.dodge) && buttons(entity.previousButtons) && integer(entity.impactPauseTicks) && integer(entity.hitFlashTicks), 'entity timers/buttons')
    check(record(entity.gait) && nonnegative(entity.gait.phase) && nonnegative(entity.gait.speed), 'gait')
    check(entity.knockback === null || (record(entity.knockback) && vector(entity.knockback.vel) &&
      positiveInteger(entity.knockback.remainingTicks)), 'knockback')
    const action = entity.action
    if (action !== null) {
      check(record(action) && death === null && integer(action.startTick) && action.startTick <= world.tick &&
        integer(action.ageTicks) && action.ageTicks <= world.tick - action.startTick && Number.isFinite(action.direction) &&
        Array.isArray(action.hitTargetIds) && typeof action.projectileSpawned === 'boolean', 'action timer')
      const definition = content.skills.find(skill => skill.id === action.id)
      check(action.kind === 'dodge' ? action.id === 'dodge' : definition && definition.kind === action.kind, 'action definition')
      const phases = action.kind === 'dodge' ? dodge.timing : definition!.timing
      check(action.ageTicks < phases.windupTicks + phases.activeTicks + phases.recoveryTicks, 'action age')
      check(action.kind === 'projectile' || !action.projectileSpawned, 'projectile launch flag')
      let lastTarget = 0
      for (const id of action.hitTargetIds) {
        check(action.kind === 'melee' && positiveInteger(id) && id > lastTarget && id < world.nextId && id !== entity.id, 'melee hit ids')
        lastTarget = id
      }
    }
    const ai = entity.ai
    check(ai === null || (record(ai) && content.enemies.some(enemy => enemy.id === ai.enemyId) &&
      ['idle', 'acquire', 'chase', 'telegraph', 'strike', 'recover', 'die'].includes(ai.phase) && integer(ai.ageTicks) &&
      (ai.targetId === null || (ai.targetId !== entity.id && actorIds.has(ai.targetId))) &&
      (ai.phase === 'die') === (death !== null)), 'AI state')
    check(death === null || death.despawnAfterTicks === (ai === null ? null :
      content.enemies.find(enemy => enemy.id === ai.enemyId)!.deathTicks), 'death duration source')
    check(death === null || (entity.action === null && entity.knockback === null && entity.vel.x === 0 && entity.vel.z === 0 &&
      entity.gait.speed === 0 && entity.impactPauseTicks === 0), 'dead actor state')
    previousId = entity.id
  }
  check(world.playerId === null || world.entities.some(entity => entity.id === world.playerId && entity.kind === 'player'), 'player')
  previousId = 0
  for (const projectile of world.projectiles) {
    check(record(projectile) && positiveInteger(projectile.id) && projectile.id > previousId && projectile.id < world.nextId &&
      !actorIds.has(projectile.id), 'projectile id')
    const owner = world.entities.find(entity => entity.id === projectile.ownerId)
    check(owner && owner.death === null && owner.faction === projectile.faction &&
      content.skills.some(skill => skill.id === projectile.skillId && skill.kind === 'projectile'), 'projectile owner/skill')
    check(integer(projectile.actionStartTick) && projectile.actionStartTick <= world.tick &&
      vector(projectile.pos) && vector(projectile.vel) && nonnegative(projectile.radius) && integer(projectile.ageTicks) &&
      positiveInteger(projectile.lifetimeTicks) && projectile.ageTicks < projectile.lifetimeTicks && nonnegative(projectile.damage) &&
      knockback(projectile.knockback) && integer(projectile.impactPauseTicks) && integer(projectile.hitFlashTicks), 'projectile data')
    previousId = projectile.id
  }
  for (const state of Object.values(world.rng)) {
    check(Array.isArray(state) && state.length === 4 && state.every(word => integer(word) && word <= 0xffffffff) &&
      state.some(word => word !== 0), 'RNG stream')
  }
}
