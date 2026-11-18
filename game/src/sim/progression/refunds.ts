import type { CharacterData, CharacterState, GraphProfile, M2Content } from '../core/types'
import { connectedNodes, markedShapes } from './graph'

function validIds(values: string[]): boolean {
  return Array.isArray(values) && values.every(id => typeof id === 'string' && id.length > 0) &&
    new Set(values).size === values.length
}

function refundGraph(character: CharacterState, profile: GraphProfile, refunds: string[]): void {
  const graph = character.graph
  const allocated = new Set(graph.allocations)
  if (!validIds(graph.allocations) || !validIds(graph.activeShapes) || graph.activeShapes.length > 2 ||
      !Number.isSafeInteger(character.points) || character.points < 0 || allocated.has('0,0') ||
      character.points + allocated.size !== character.rank + 3 || allocated.size > 24) throw new TypeError('Invalid allocation budget')
  const connected = connectedNodes(graph.allocations, profile.radius)
  graph.allocations = graph.allocations.filter(id => {
    if (connected.has(id)) return true
    character.points++
    refunds.push(`Refunded one point for node ${id}.`)
    return false
  })
  const shapes = markedShapes(profile)
  graph.activeShapes = graph.activeShapes.filter(id => {
    const valid = shapes.find(shape => shape.id === id)?.perimeter.every(node => connected.has(node))
    if (!valid) refunds.push(`Deactivated shape ${id}.`)
    return valid
  })
  graph.version = profile.version
}

/** Update a detached older projection before validating it against current content. */
export function refundRemovedContent(data: CharacterData, content: M2Content): string[] {
  if (data.contentVersion === content.version) return []
  const refunds: string[] = []
  const character = data.character
  const profile = content.graphProfiles.find(profile => profile.id === character.graph.profileId)
  if (!profile) throw new TypeError('Unknown graph profile')
  refundGraph(character, profile, refunds)

  if (character.loadout.length !== 6 || !validIds(character.loadout.filter(id => id !== null))) {
    throw new TypeError('Invalid saved loadout')
  }
  const skills = new Set(content.actions.map(action => action.id))
  for (const [slot, skill] of character.loadout.entries()) {
    if (skill === null || skills.has(skill)) continue
    const fallback = ['span-cut', 'fold-dart'][slot]
    const replacement = fallback && skills.has(fallback) && !character.loadout.includes(fallback) ? fallback : null
    character.loadout[slot] = replacement
    refunds.push(replacement ? `Replaced ${skill} with ${replacement}.` : `Cleared missing skill ${skill}.`)
  }
  for (const [skill, folds] of Object.entries(character.folds)) {
    if (!validIds(folds) || folds.length > 2) throw new TypeError('Invalid saved folds')
    if (!skills.has(skill)) {
      delete character.folds[skill]
      refunds.push(`Cleared folds for missing skill ${skill}.`)
      continue
    }
    character.folds[skill] = folds.filter(id => {
      if (content.folds.some(fold => fold.id === id)) return true
      refunds.push(`Removed fold ${id} from ${skill}.`)
      return false
    })
  }

  const families = [...content.affixes].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  for (const item of character.items) {
    if (typeof item.baseId !== 'string' || !item.baseId) throw new TypeError('Invalid saved item base')
    if (!content.itemBases.some(base => base.id === item.baseId)) {
      const starter = content.itemBases.find(base => base.starter && base.role === item.role)
      if (!starter) throw new TypeError('Missing starter base')
      refunds.push(`Replaced ${item.baseId} with ${starter.name}.`)
      item.baseId = starter.id
    }
    for (const affix of item.affixes) {
      if (typeof affix.familyId !== 'string' || !affix.familyId || ![1, 2, 3].includes(affix.tier) ||
          !Number.isSafeInteger(affix.roll) || affix.roll < 0) throw new TypeError('Invalid saved affix')
      if (families.some(family => family.id === affix.familyId)) continue
      const family = families.find(family => family.category === affix.category && family.roles.includes(item.role))
      const tier = family?.tiers.find(tier => tier.tier === 1)
      if (!family || !tier) throw new TypeError('Missing replacement affix')
      refunds.push(`Replaced ${affix.familyId} with ${family.name}.`)
      Object.assign(affix, { familyId: family.id, tier: 1, roll: tier.min })
    }
  }
  data.contentVersion = content.version
  return refunds
}
