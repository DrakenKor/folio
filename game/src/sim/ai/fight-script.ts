import { Button, IDLE_COMMAND } from '../core/types'
import type { Command, World } from '../core/types'

/** Author fixture inputs from observations; never change actors, health or timers. */
export function fightCommand(world: World): Command {
  const player = world.entities.find(actor => actor.id === world.playerId)!
  const enemies = world.entities.filter(actor => actor.ai && !actor.death)
  if (player.death || enemies.length === 0) return IDLE_COMMAND
  // The first wave demonstrates an incoming hit before the player responds.
  if (world.tick < 600 && player.health === player.maxHealth) return IDLE_COMMAND
  const target = enemies.reduce((nearest, actor) => {
    const distance = (actor.pos.x - player.pos.x) * (actor.pos.x - player.pos.x) +
      (actor.pos.z - player.pos.z) * (actor.pos.z - player.pos.z)
    const previous = (nearest.pos.x - player.pos.x) * (nearest.pos.x - player.pos.x) +
      (nearest.pos.z - player.pos.z) * (nearest.pos.z - player.pos.z)
    return distance < previous ? actor : nearest
  })
  const x = target.pos.x - player.pos.x
  const z = target.pos.z - player.pos.z
  const aim = { x: Math.round(target.pos.x * 4) / 4, z: Math.round(target.pos.z * 4) / 4 }
  const threat = enemies.find(enemy => enemy.action && enemy.action.ageTicks >= 18 && enemy.action.ageTicks < 27 &&
    (enemy.pos.x - player.pos.x) * (enemy.pos.x - player.pos.x) +
    (enemy.pos.z - player.pos.z) * (enemy.pos.z - player.pos.z) < 4)
  if (threat && player.cooldowns.dodge === 0 && !(player.previousButtons & Button.Dodge)) {
    return { move: { x: -z, z: x }, aim, buttons: Button.Dodge }
  }
  // Let one first-wave warning finish so the fixture also demonstrates evasion.
  if (world.tick < 600 && player.cooldowns.dodge === 0 &&
    enemies.some(enemy => enemy.action && enemy.action.ageTicks < 18)) return IDLE_COMMAND
  const distance = Math.sqrt(x * x + z * z)
  return {
    move: { x: 0, z: 0 }, aim,
    buttons: distance > 1.7 ? Button.Secondary : Button.Primary
  }
}
