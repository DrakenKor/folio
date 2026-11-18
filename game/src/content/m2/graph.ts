import type { ActionTag, DamageType, StatModifier } from '../../sim/core/types'
import type { GraphProfile } from '../schema'
import { modifierScope } from './modifiers'

type Orientation = {
  requiredTags: ActionTag[]
  types: DamageType[]
  price: Pick<StatModifier, 'requiredTags' | 'value'> & {
    kind: 'reachMultiplier' | 'healthMultiplier' | 'dodgeCooldown' | 'recovery'
  }
}

const ORIENTATIONS: Orientation[] = [
  { requiredTags: ['melee'], types: [], price: { kind: 'reachMultiplier', value: .9, requiredTags: ['projectile'] } },
  { requiredTags: ['cast'], types: [], price: { kind: 'reachMultiplier', value: .9, requiredTags: ['melee'] } },
  { requiredTags: ['area'], types: [], price: { kind: 'healthMultiplier', value: .9, requiredTags: [] } },
  { requiredTags: ['projectile'], types: [], price: { kind: 'dodgeCooldown', value: 6, requiredTags: [] } },
  { requiredTags: [], types: ['heat'], price: { kind: 'recovery', value: 3, requiredTags: [] } },
  { requiredTags: [], types: ['gale'], price: { kind: 'reachMultiplier', value: .9, requiredTags: ['melee'] } }
]

function bargain(id: string, rule: Orientation, value: number): StatModifier[] {
  return [
    { ...modifierScope(`${id}-damage`, rule.requiredTags, rule.types), kind: 'multiplier', value },
    { ...modifierScope(`${id}-price`, rule.price.requiredTags), kind: rule.price.kind, value: rule.price.value }
  ]
}

export const graphProfile: GraphProfile = {
  id: 'windstep-lattice', version: 1, radius: 7,
  families: [
    { id: 'weight-boost', name: 'Weight Boost', modifiers: [{ ...modifierScope('weight-boost', [], ['weight']), kind: 'boost', value: .05 }] },
    { id: 'heat-boost', name: 'Heat Boost', modifiers: [{ ...modifierScope('heat-boost', [], ['heat']), kind: 'boost', value: .05 }] },
    { id: 'gale-boost', name: 'Gale Boost', modifiers: [{ ...modifierScope('gale-boost', [], ['gale']), kind: 'boost', value: .05 }] },
    { id: 'melee-boost', name: 'Melee Boost', modifiers: [{ ...modifierScope('melee-boost', ['melee']), kind: 'boost', value: .05 }] },
    { id: 'cast-boost', name: 'Cast Boost', modifiers: [{ ...modifierScope('cast-boost', ['cast']), kind: 'boost', value: .05 }] },
    { id: 'health', name: 'Health', modifiers: [{ ...modifierScope('health'), kind: 'health', value: 4 }] }
  ],
  bargains: ORIENTATIONS.map((rule, orientation) => ({
    orientation,
    rhombus: bargain(`rhombus-${orientation}`, rule, 1.1),
    hexagon: bargain(`hexagon-${orientation}`, rule, 1.15)
  }))
}
