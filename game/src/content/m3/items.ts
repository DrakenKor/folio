import type { M3ItemBase } from '../../sim/core/types'
import { itemBases as legacyBases } from '../m2/items'

const shortblade = legacyBases.find(base => base.id === 'shortblade')!

export const itemBases: M3ItemBase[] = [
  { ...shortblade, role: 'weapon', familyId: 'hemblade' },
  { ...shortblade, id: 'plumbshoe', name: 'Plumbshoe', role: 'weapon', familyId: 'plumbshoe', starter: false },
  { ...shortblade, id: 'verge-reel', name: 'Verge Reel', role: 'weapon', familyId: 'verge-reel', starter: false },
  { ...shortblade, id: 'hearth-frame', name: 'Hearth Frame', role: 'weapon', familyId: 'hearth-frame', starter: false },
  ...legacyBases.flatMap(base => base.role === 'weapon' ? [] : [{ ...base, role: base.role }])
]
