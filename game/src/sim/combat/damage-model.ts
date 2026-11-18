import { DAMAGE_TYPES } from '../core/types'
import type { DamagePreview, DamageValues, ResolvedAction, StatModifier } from '../core/types'
import { add, multiply } from './decimal'
import { zeroDamage } from './stats'

export function baseAndFlats(base: DamageValues, mods: StatModifier[]): DamageValues {
  const flats = zeroDamage()
  for (const mod of mods) if (mod.kind === 'flat') flats[mod.damageType] = add(flats[mod.damageType], mod.value)
  return { weight: add(base.weight, flats.weight), heat: add(base.heat, flats.heat), gale: add(base.gale, flats.gale) }
}

/** Convert each original pool once, then scale only its destination types. */
export function calculateDamage(recipe: ResolvedAction, reductions: DamageValues, health: number): DamagePreview {
  const baseAndFlat = baseAndFlats(recipe.sourceDamage, recipe.modifiers)
  const requests = { weight: zeroDamage(), heat: zeroDamage(), gale: zeroDamage() }
  const boosts = zeroDamage()
  const multipliers = { weight: 1, heat: 1, gale: 1 }
  for (const mod of recipe.modifiers) {
    if (mod.kind === 'conversion') requests[mod.from][mod.to] = add(requests[mod.from][mod.to], mod.value)
    if (mod.kind !== 'boost' && mod.kind !== 'multiplier') continue
    for (const type of mod.types.length ? mod.types : DAMAGE_TYPES) {
      if (mod.kind === 'boost') boosts[type] = add(boosts[type], mod.value)
      else multipliers[type] = multiply(multipliers[type], mod.value)
    }
  }
  const converted = zeroDamage()
  const conversions: DamagePreview['conversions'] = []
  for (const from of DAMAGE_TYPES) {
    const outgoing = requests[from]
    const total = add(outgoing.heat, outgoing.gale)
    for (const to of DAMAGE_TYPES) {
      const requested = outgoing[to]
      if (requested === 0) continue
      const effective = requested / Math.max(1, total)
      conversions.push({ from, to, requested, effective })
      converted[to] = add(converted[to], multiply(baseAndFlat[from], effective))
    }
    converted[from] = add(converted[from], multiply(baseAndFlat[from], Math.max(0, add(1, -total))))
  }
  const postDefence = zeroDamage()
  let total = 0
  for (const type of DAMAGE_TYPES) {
    const boosted = multiply(converted[type], Math.max(0, add(1, boosts[type])))
    postDefence[type] = multiply(multiply(boosted, multipliers[type]), add(1, -reductions[type]))
    total = add(total, postDefence[type])
  }
  const calculated = Math.round(total)
  return { baseAndFlat, converted, conversions, boosts, multipliers, reductions, postDefence, calculated,
    applied: Math.min(calculated, health) }
}
