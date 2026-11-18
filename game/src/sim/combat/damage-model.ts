import { DAMAGE_TYPES } from '../core/types'
import type { DamagePreview, DamageValues, ResolvedAction, StatModifier } from '../core/types'
import { zeroDamage } from './stats'

export function baseAndFlats(base: DamageValues, mods: StatModifier[]): DamageValues {
  const flats = zeroDamage()
  for (const mod of mods) if (mod.kind === 'flat') flats[mod.damageType] += mod.value
  return { weight: base.weight + flats.weight, heat: base.heat + flats.heat, gale: base.gale + flats.gale }
}

/** Convert each original pool once, then scale only its destination types. */
export function calculateDamage(recipe: ResolvedAction, reductions: DamageValues, health: number): DamagePreview {
  const baseAndFlat = baseAndFlats(recipe.sourceDamage, recipe.modifiers)
  const requests = { weight: zeroDamage(), heat: zeroDamage(), gale: zeroDamage() }
  const boosts = zeroDamage()
  const multipliers = { weight: 1, heat: 1, gale: 1 }
  for (const mod of recipe.modifiers) {
    if (mod.kind === 'conversion') requests[mod.from][mod.to] += mod.value
    if (mod.kind !== 'boost' && mod.kind !== 'multiplier') continue
    for (const type of mod.types.length ? mod.types : DAMAGE_TYPES) {
      if (mod.kind === 'boost') boosts[type] += mod.value
      else multipliers[type] *= mod.value
    }
  }
  const converted = zeroDamage()
  const conversions: DamagePreview['conversions'] = []
  for (const from of DAMAGE_TYPES) {
    const outgoing = requests[from]
    const total = outgoing.heat + outgoing.gale
    for (const to of DAMAGE_TYPES) {
      const requested = outgoing[to]
      if (requested === 0) continue
      const effective = requested / Math.max(1, total)
      conversions.push({ from, to, requested, effective })
      converted[to] += baseAndFlat[from] * effective
    }
    converted[from] += baseAndFlat[from] * Math.max(0, 1 - total)
  }
  const postDefence = zeroDamage()
  let total = 0
  for (const type of DAMAGE_TYPES) {
    postDefence[type] = converted[type] * Math.max(0, 1 + boosts[type]) * multipliers[type] * (1 - reductions[type])
    total += postDefence[type]
  }
  const calculated = Math.floor(total + .5)
  return { baseAndFlat, converted, conversions, boosts, multipliers, reductions, postDefence, calculated,
    applied: Math.min(calculated, health) }
}
