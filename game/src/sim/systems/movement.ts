import { fmath } from '../core/fmath'
import { TICK_DT } from '../core/types'
import type { Command, Entity, World } from '../core/types'

/** Integrate velocity, separate circles, and turn the player towards its aim point. */
export function moveEntities(world: World, command: Command): void {
  const player = world.entities.find(entity => entity.id === world.playerId)
  if (player) {
    const length = Math.sqrt(command.move.x * command.move.x + command.move.z * command.move.z)
    const scale = 6 / Math.max(1, length)
    player.vel.x = command.move.x * scale
    player.vel.z = command.move.z * scale
  }
  for (const entity of world.entities) {
    entity.pos.x += entity.vel.x * TICK_DT
    entity.pos.z += entity.vel.z * TICK_DT
  }
  resolveCircles(world.entities)
  if (player && command.aim) {
    const dx = command.aim.x - player.pos.x
    const dz = command.aim.z - player.pos.z
    if (dx !== 0 || dz !== 0) player.facing = fmath.atan2(dz, dx)
  }
}

function resolveCircles(entities: Entity[]): void {
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
    if (!separated) break
  }
}
