import { m1Content } from '../m1'
import { contentSchema } from '../schema'
import type { CombatContent } from '../../sim/core/types'
import { actions } from './actions'
import { folds } from './folds'
import { graphProfile } from './graph'
import { affixes, creasebackLoot, itemBases } from './items'

/** Return detached M2 cards and the existing enemy and dodge definitions. */
export function m2Content(): CombatContent {
  const { skills, enemies, dodge } = m1Content()
  return contentSchema.parse({
    skills: skills.filter(skill => enemies.some(enemy => enemy.skillId === skill.id)), enemies, dodge,
    m2: { version: 'm2-v1', actions, folds, graphProfiles: [graphProfile], itemBases, affixes, lootTables: [creasebackLoot] }
  })
}
