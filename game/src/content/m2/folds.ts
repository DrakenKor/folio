import type { StatModifier } from '../../sim/core/types'
import type { FoldDefinition } from '../schema'
import { modifierScope } from './modifiers'

const fold = (card: Pick<FoldDefinition, 'id' | 'name' | 'handle' | 'tension' | 'compatibility'> & Partial<FoldDefinition>): FoldDefinition => ({
  modifiers: [], reachFactor: 1, arcFactor: 1, radiusFactor: 1, windupDelta: 0, recoveryDelta: 0,
  projectileAngles: [0], ...card
})

const multiplier = (id: string, value: number): StatModifier => ({ ...modifierScope(id), kind: 'multiplier', value })

export const folds = [
  fold({ id: 'long-pleat', name: 'Long Pleat', handle: 'reach', tension: 2, compatibility: 'finite-reach',
    reachFactor: 1.5, recoveryDelta: 6, modifiers: [multiplier('long-pleat-damage', .8)] }),
  fold({ id: 'short-pleat', name: 'Short Pleat', handle: 'reach', tension: 1, compatibility: 'finite-reach',
    reachFactor: .75, modifiers: [multiplier('short-pleat-damage', 1.15)] }),
  fold({ id: 'stanch-pleat', name: 'Stanch Pleat', handle: 'reach', tension: 1, compatibility: 'finite-reach',
    reachFactor: .85, recoveryDelta: -4 }),
  fold({ id: 'splay-pleat', name: 'Splay Pleat', handle: 'spread', tension: 1, compatibility: 'single-projectile',
    projectileAngles: [-18, 0, 18], modifiers: [multiplier('splay-pleat-damage', .45)] }),
  fold({ id: 'close-pleat', name: 'Close Pleat', handle: 'spread', tension: 1, compatibility: 'melee-sector',
    arcFactor: .7, modifiers: [multiplier('close-pleat-damage', 1.2)] }),
  fold({ id: 'broad-pleat', name: 'Broad Pleat', handle: 'spread', tension: 1, compatibility: 'sector',
    arcFactor: 1.4, modifiers: [multiplier('broad-pleat-damage', .8)] }),
  fold({ id: 'fine-pleat', name: 'Fine Pleat', handle: 'spread', tension: 1, compatibility: 'single-projectile',
    radiusFactor: .6, modifiers: [multiplier('fine-pleat-damage', 1.15)] }),
  fold({ id: 'kiln-pleat', name: 'Kiln Pleat', handle: 'material', tension: 2, compatibility: 'positive-weight',
    recoveryDelta: 6, modifiers: [{ ...modifierScope('kiln-pleat-conversion'), kind: 'conversion', from: 'weight', to: 'heat', value: .4 }] }),
  fold({ id: 'vane-pleat', name: 'Vane Pleat', handle: 'material', tension: 2, compatibility: 'positive-weight',
    reachFactor: .85, modifiers: [{ ...modifierScope('vane-pleat-conversion'), kind: 'conversion', from: 'weight', to: 'gale', value: .4 }] }),
  fold({ id: 'draft-pleat', name: 'Draft Pleat', handle: 'material', tension: 2, compatibility: 'positive-heat',
    modifiers: [{ ...modifierScope('draft-pleat-conversion'), kind: 'conversion', from: 'heat', to: 'gale', value: .5 },
      multiplier('draft-pleat-damage', .9)] }),
  fold({ id: 'ballast-pleat', name: 'Ballast Pleat', handle: 'material', tension: 1, compatibility: 'any',
    windupDelta: 4, modifiers: [{ ...modifierScope('ballast-pleat-weight'), kind: 'flat', damageType: 'weight', value: 8 }] }),
  fold({ id: 'hush-pleat', name: 'Hush Pleat', handle: 'material', tension: 1, compatibility: 'any',
    recoveryDelta: 6, modifiers: [{ ...modifierScope('hush-pleat-gale'), kind: 'flat', damageType: 'gale', value: 8 }] })
]
