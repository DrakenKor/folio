import { driveEnemies } from '../creaseback'
import { sharedBuildView } from '../../core/profile'
import { Button, TICK_HZ } from '../../core/types'
import type { ActionDefinition, Entity, Footprint, M3World, SimEvent } from '../../core/types'
import { consumeIntent, type ActorTick } from '../../systems/actors'
import { selectAction, skillDefinition } from '../../combat/actions'
import { resolveRecipe } from '../../combat/recipe'
import { along, clip, distance, heading, overlap, shape, visible } from '../../combat/m3/geometry'
import { record } from '../../combat/m3/records'

function warningShape(world: M3World, actor: Entity, target: Entity): Footprint {
  const enemy = world.content.enemies.find(e => e.id === actor.ai!.enemyId)!
  const authored = enemy.warnings?.[0]?.footprint
  const angle = heading(actor.pos, target.pos)
  if (!authored) {
    const skill = skillDefinition(sharedBuildView(world), enemy.skillId)
    return skill.kind === 'melee' ? shape('sector', actor.pos, angle, skill.range, 0, 0, skill.arcRadians) :
      shape('lane', actor.pos, angle, skill.speed * skill.lifetimeTicks / TICK_HZ, skill.radius)
  }
  const origin = authored.kind === 'disc' ? target.pos : actor.pos
  return { ...authored, origin: { ...origin }, direction: angle + authored.direction }
}

export function driveM3Enemies(world: M3World, states: Map<number, ActorTick>) {
  driveEnemies(sharedBuildView(world), states)
  for (const actor of world.entities) {
    const state = states.get(actor.id)!
    if (!actor.ai || !(state.command.buttons & Button.Primary)) continue
    const target = world.entities.find(e => e.id === actor.ai!.targetId)!
    const f = warningShape(world, actor, target)
    if (visible(world, actor.pos, target.pos) && overlap(world, f, target) !== null) continue
    actor.ai.phase = 'chase'
    consumeIntent(actor, state, { move: { x: target.pos.x - actor.pos.x, z: target.pos.z - actor.pos.z }, aim: target.pos, buttons: 0 })
  }
}

export function startEnemy(world: M3World, actor: Entity, state: ActorTick, events: SimEvent[]) {
  const view = sharedBuildView(world)
  selectAction(view, actor, state, events)
  const a = actor.action
  if (!a || a.startTick !== world.tick || a.kind === 'dodge') return
  const enemy = world.content.enemies.find(e => e.id === actor.ai!.enemyId)!
  const skill = skillDefinition(view, a.id)
  const target = world.entities.find(e => e.id === actor.ai!.targetId)!
  const footprint = warningShape(world, actor, target)
  if (!a.recipe) {
    const card: ActionDefinition = { ...skill, name: skill.id, tags: [skill.kind === 'melee' ? 'melee' : 'projectile'],
      reach: skill.kind === 'melee' ? skill.range : skill.speed * skill.lifetimeTicks / TICK_HZ,
      weaponCoefficient: 0, baseDamage: { weight: skill.damage, heat: 0, gale: 0 } }
    const resolved = resolveRecipe(view, actor, card)
    if (!resolved.ok) return
    a.recipe = resolved.value
  }
  const r = a.recipe, warning = enemy.warnings?.[0]
  if (warning) r.timing = { windupTicks: warning.delayTicks, activeTicks: 1,
    recoveryTicks: warning.recoveryTicks, moveCancelTicks: warning.recoveryTicks }
  if (footprint.kind === 'lane') {
    const end = clip(world, actor.pos, along(actor.pos, footprint.direction, footprint.reach))
    footprint.reach = distance(actor.pos, end)
  }
  const due = world.tick + r.timing.windupTicks
  const effect = record(world, actor, r, 'warning', footprint, due)
  effect.endpoint = { ...actor.pos }
  actor.ai!.committedEffectIds = [effect.id]
}

/** Finish a committed rush before gathering any actor's contacts. */
export function moveRushes(world: M3World) {
  for (const e of world.effects) {
    if (e.kind !== 'warning' || e.footprint.kind !== 'lane' || e.dueTick !== world.tick) continue
    const actor = world.entities.find(a => a.id === e.ownerId)
    const { origin, direction, reach } = e.footprint
    if (actor && !actor.death) actor.pos = clip(world, actor.pos, along(origin, direction, reach))
  }
}
