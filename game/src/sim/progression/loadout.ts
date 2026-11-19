import type { CharacterState, Loadout, M3Content } from '../core/types'

export function weaponFamily(character: CharacterState, content: M3Content) {
  const item = character.items.find(i => i.id === character.equipment.weapon)
  const base = content.itemBases.find(b => b.id === item?.baseId)
  return base?.role === 'weapon' ? base.familyId : null
}

/** Preserve eligible bindings, then fill the requested slots in card order. */
export function repairLoadout(character: CharacterState, content: M3Content, mode: 'family' | 'tally' | 'migration'): Loadout {
  const family = weaponFamily(character, content)
  const drawings = content.actions.filter(a => a.familyId === family)
  const casts = content.actions.filter(a => a.familyId === 'survey-tally' && character.equipment['survey-tally'] !== null)
  const eligible = [...drawings, ...casts].map(a => a.id)
  const slots: Loadout = [...character.loadout]
  const vacated: number[] = []
  for (const [i, id] of slots.entries()) {
    if (id !== null && !eligible.includes(id)) {
      slots[i] = null
      vacated.push(i)
    }
  }
  if (mode === 'tally') return slots
  const empty = slots.flatMap((id, i) => id === null ? [i] : [])
  const available = mode === 'migration' ? empty : [...vacated, ...empty.filter(i => !vacated.includes(i))]
  for (const id of mode === 'migration' ? eligible : drawings.map(a => a.id)) {
    if (!slots.includes(id)) slots[available.shift()!] = id
  }
  return slots
}
