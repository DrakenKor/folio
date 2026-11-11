import { describe, expect, it } from 'vitest'
import { m1Content as acceptanceContent } from '../sim/acceptance/fixtures'
import { restore, serialize } from '../sim/core/snapshot'
import { buildScenario } from '../sim/scenarios'
import { m1Content } from './m1'

describe('approved M1 content and construction', () => {
  it('matches the approved content exercised by all T1.2 acceptance cases', () => {
    expect(m1Content()).toEqual(acceptanceContent())
  })

  it.each(['m1-arena', 'm1-fight', 'm1-stress'])('%s constructs identically and round trips', name => {
    const first = buildScenario(name, 7)
    expect(serialize(first)).toBe(serialize(buildScenario(name, 7)))
    expect(restore(serialize(first))).toEqual(first)
    expect(first.content.skills.map(skill => skill.id)).toEqual(['creaseback-strike', 'fold-dart', 'span-cut'])
    expect([...new Set(first.entities.filter(actor => actor.ai).map(actor => actor.ai!.enemyId))]).toEqual(['creaseback'])
    expect(first.arena).toEqual({ center: { x: 0, z: 0 }, radius: 8 })
  })

  it('assigns the fixed encounter and independent approved definitions', () => {
    const first = buildScenario('m1-arena', 7)
    const second = buildScenario('m1-arena', 7)
    expect(first.entities.map(actor => actor.pos)).toEqual([
      { x: -3, z: 0 }, { x: 2, z: 0 }, { x: 3, z: 2 }, { x: 3, z: -2 }
    ])
    expect(first.entities.map(actor => actor.health)).toEqual([120, 72, 72, 72])
    expect(first.entities.map(actor => actor.radius)).toEqual([0.32, 0.45, 0.45, 0.45])
    first.content.skills[0]!.damage = 1
    expect(second.content).toEqual(m1Content())
    expect(second.content.skills[0]!.damage).toBe(20)
  })

  it('keeps the synthetic stress load separate: player, twelve Creasebacks, sixteen darts', () => {
    const world = buildScenario('m1-stress', 7)
    expect(world.entities).toHaveLength(13)
    expect(world.projectiles).toHaveLength(16)
    expect(world.projectiles.every(shot => shot.skillId === 'fold-dart')).toBe(true)
    expect(buildScenario('m1-arena', 7).projectiles).toHaveLength(0)
  })
})
