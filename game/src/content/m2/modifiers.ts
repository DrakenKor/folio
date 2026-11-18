import type { ActionTag, DamageType } from '../../sim/core/types'

export function modifierScope(id: string, requiredTags: ActionTag[] = [], types: DamageType[] = []) {
  return { id, requiredTags: [...requiredTags], types: [...types] }
}
