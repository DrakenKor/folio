import type { Entity, SimEvent, World } from '../core/types'

export function kill(world: World, target: Entity, sourceId: number, events: SimEvent[]): void {
  target.action = null
  target.vel = { x: 0, z: 0 }
  target.gait.speed = 0
  target.knockback = null
  target.impactPauseTicks = 0
  target.death = {
    startTick: world.tick, ageTicks: 0,
    despawnAfterTicks: target.ai ? world.content.enemies.find(enemy => enemy.id === target.ai!.enemyId)!.deathTicks : null
  }
  if (target.ai) {
    target.ai.phase = 'die'
    target.ai.ageTicks = 0
    target.ai.targetId = null
  }
  world.ailments = world.ailments.filter(ailment => ailment.targetId !== target.id)
  world.projectiles = world.projectiles.filter(shot => shot.ownerId !== target.id)
  events.push({ tick: world.tick, actorId: sourceId, targetId: target.id, type: 'death', position: { ...target.pos } })
}
