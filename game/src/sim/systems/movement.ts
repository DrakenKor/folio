import { actionTiming, movementInput } from '../combat/actions'
import { fmath } from '../core/fmath'
import { actionPhase } from '../core/timing'
import { BODY_TURN_PER_TICK, GAIT, TICK_DT, TICK_HZ } from '../core/types'
import type { Entity, EntityId, World } from '../core/types'
import type { ActorTick } from './actors'

function turnToward(facing: number, target: number): number {
  const tau = 2 * Math.PI
  let delta = ((target - facing) % tau + tau) % tau
  if (delta > Math.PI) delta -= tau
  const turned = facing + Math.max(-BODY_TURN_PER_TICK, Math.min(BODY_TURN_PER_TICK, delta))
  return ((turned + Math.PI) % tau + tau) % tau - Math.PI
}

function applyBounds(world: World, actor: Entity): void {
  if (!world.arena) return
  const { center, radius } = world.arena
  const x = actor.pos.x - center.x
  const z = actor.pos.z - center.z
  const distance = Math.sqrt(x * x + z * z)
  if (distance <= radius) return
  actor.pos.x = center.x + x / distance * radius
  actor.pos.z = center.z + z / distance * radius
}

/** Turn, integrate the selected motion, then resolve living actor circles and bounds. */
export function moveEntities(world: World, states: Map<EntityId, ActorTick>): void {
  for (const actor of world.entities) {
    const state = states.get(actor.id)!
    if (actor.death || state.paused) continue
    const { direction, magnitude } = movementInput(state.command.move)
    const target = actor.action?.direction ?? (magnitude > 0 ? fmath.atan2(direction.z, direction.x) : actor.aim)
    actor.facing = turnToward(actor.facing, target)
    actor.vel = { x: 0, z: 0 }
    if (actor.knockback) {
      actor.vel = { ...actor.knockback.vel }
      if (--actor.knockback.remainingTicks === 0) actor.knockback = null
    } else if (actor.action) {
      if (actor.action.kind === 'dodge' && actionPhase(actionTiming(world, actor)!, actor.action.ageTicks) === 'active') {
        const speed = world.content.dodge.distance * TICK_HZ / world.content.dodge.timing.activeTicks
        actor.vel = { x: fmath.cos(actor.action.direction) * speed, z: fmath.sin(actor.action.direction) * speed }
      }
    } else if (magnitude > 0) {
      const speed = actor.id === world.playerId ? GAIT.runSpeed : actor.ai ?
        world.content.enemies.find(enemy => enemy.id === actor.ai!.enemyId)!.moveSpeed : 1
      actor.vel = { x: fmath.cos(actor.facing) * speed * magnitude, z: fmath.sin(actor.facing) * speed * magnitude }
      state.ordinary = { x: actor.vel.x * TICK_DT, z: actor.vel.z * TICK_DT }
    }
    actor.pos.x += actor.vel.x * TICK_DT
    actor.pos.z += actor.vel.z * TICK_DT
    applyBounds(world, actor)
  }
  resolveCircles(world.entities.filter(actor => !actor.death), actor => applyBounds(world, actor))
}

/** Derive stride travel from the resolved projection, excluding external displacement. */
export function finalizeGait(world: World, states: Map<EntityId, ActorTick>): void {
  for (const actor of world.entities) {
    const state = states.get(actor.id)!
    if (state.paused || actor.death) continue
    const { x, z } = state.ordinary
    const intended = Math.sqrt(x * x + z * z)
    const projection = intended === 0 ? 0 :
      ((actor.pos.x - state.entryPosition.x) * x + (actor.pos.z - state.entryPosition.z) * z) / intended
    const distance = Math.max(0, Math.min(intended, projection))
    actor.gait.speed = distance * TICK_HZ
    const blend = Math.max(0, Math.min(1, (actor.gait.speed - GAIT.walkSpeed) / (GAIT.runSpeed - GAIT.walkSpeed)))
    actor.gait.phase += distance / (GAIT.walkStride + (GAIT.runStride - GAIT.walkStride) * blend)
  }
}

function resolveCircles(entities: Entity[], bound: (actor: Entity) => void): void {
  let diameter = 0
  for (const entity of entities) diameter = Math.max(diameter, 2 * entity.radius)
  if (diameter === 0) return
  // Rebuild between fixed solver passes; bucket members retain id order.
  for (let pass = 0; pass < 4; pass++) {
    const cells = new Map<number, Map<number, number[]>>()
    const coords = entities.map((entity, i) => {
      const x = Math.floor(entity.pos.x / diameter)
      const z = Math.floor(entity.pos.z / diameter)
      let column = cells.get(x)
      if (!column) {
        column = new Map<number, number[]>()
        cells.set(x, column)
      }
      const bucket = column.get(z)
      if (bucket) bucket.push(i)
      else column.set(z, [i])
      return { x, z }
    })
    let separated = false
    for (let i = 0; i < entities.length; i++) {
      const a = entities[i]!
      const cell = coords[i]!
      for (let x = cell.x - 1; x <= cell.x + 1; x++) {
        const column = cells.get(x)
        if (!column) continue
        for (let z = cell.z - 1; z <= cell.z + 1; z++) {
          const bucket = column.get(z)
          if (!bucket) continue
          for (const j of bucket) {
            if (j <= i) continue
            const b = entities[j]!
            const dx = b.pos.x - a.pos.x
            const dz = b.pos.z - a.pos.z
            const radius = a.radius + b.radius
            const square = dx * dx + dz * dz
            if (square >= radius * radius || radius === 0) continue
            const distance = Math.sqrt(square)
            if (radius - distance <= 1e-12) continue
            const push = (radius - distance) / 2
            const nx = distance === 0 ? 1 : dx / distance
            const nz = distance === 0 ? 0 : dz / distance
            a.pos.x -= nx * push
            a.pos.z -= nz * push
            b.pos.x += nx * push
            b.pos.z += nz * push
            separated = true
          }
        }
      }
    }
    for (const actor of entities) bound(actor)
    if (!separated) break
  }
}
