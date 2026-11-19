import { M3_VERSION } from '../../sim/core/types'
import type { M3World } from '../../sim/core/types'
import { m1Content } from '../m1'
import { graphProfile } from '../m2/graph'
import { affixes, creasebackLoot } from '../m2/items'
import { actions, folds } from './combat'
import { itemBases } from './items'
import { enemies, skills } from './pressure'

/** Authored clearing tables; createWorld validates and detaches them. */
export const m3ClearingContent: M3World['content'] = {
  skills, enemies, dodge: m1Content().dodge,
  m3: { version: M3_VERSION, actions, folds, itemBases, graphProfiles: [graphProfile], affixes, lootTables: [creasebackLoot] }
}
