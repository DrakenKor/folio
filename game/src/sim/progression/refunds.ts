import { EQUIPMENT_ROLES } from '../core/types'
import type { CharacterData, CharacterState, GraphProfile, M2Content, M3Content } from '../core/types'
import { connectedNodes, markedShapes } from './graph'
import { repairLoadout } from './loadout'

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

function refundLegacyDrawings(character: CharacterState, content: M2Content, refunds: string[]) {
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
}

export function validateSourceItems(data: CharacterData, content: M2Content) {
  const c = data.character
  const owned = new Set(c.items.map(i => i.id))
  const placed = [...c.inventory, ...c.stash, ...Object.values(c.equipment).filter(id => id !== null)]
  if (Object.keys(c.equipment).length !== EQUIPMENT_ROLES.length || owned.size !== c.items.length ||
      placed.length !== owned.size || placed.length !== new Set(placed).size ||
      placed.some(id => !owned.has(id) || !Number.isSafeInteger(id) || id < 1 || id >= data.nextItemId) ||
      EQUIPMENT_ROLES.some(role => c.equipment[role] !== null && !c.items.some(i => i.id === c.equipment[role] && i.role === role))) {
    throw new TypeError('Invalid saved item ownership')
  }
  for (const item of c.items) {
    if (new Set(item.affixes.map(a => a.familyId)).size !== item.affixes.length) throw new TypeError('Duplicate affix family')
    for (const affix of item.affixes) {
      const known = content.affixes.find(f => f.id === affix.familyId)
      const pool = known ? [known] : content.affixes
      if (!Number.isSafeInteger(affix.roll) || affix.roll < 0) throw new TypeError('Invalid saved affix roll')
      if (!pool.some(f => f.category === affix.category &&
          f.roles.includes(item.role) && f.tiers.some(t => t.tier === affix.tier && t.unlockRank <= c.rank &&
            affix.roll >= t.min && affix.roll <= t.max))) throw new TypeError('Invalid saved affix tier or roll')
    }
  }
}

export function refundGraphAndItems(character: CharacterState, content: M2Content, refunds: string[]) {
  const profile = content.graphProfiles.find(profile => profile.id === character.graph.profileId)
  if (!profile || !Number.isSafeInteger(character.graph.version) || character.graph.version < 1) throw new TypeError('Invalid graph profile')
  refundGraph(character, profile, refunds)
  const families = [...content.affixes].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  for (const item of character.items) {
    if (typeof item.baseId !== 'string' || !item.baseId) throw new TypeError('Invalid saved item base')
    if (!content.itemBases.some(base => base.id === item.baseId)) {
      const starter = content.itemBases.find(base => base.starter && base.role === item.role)
      if (!starter) throw new TypeError('Missing starter base')
      refunds.push(`Replaced ${item.baseId} on item ${item.id} with ${starter.name}.`)
      item.baseId = starter.id
    }
    for (const affix of item.affixes) {
      if (typeof affix.familyId !== 'string' || !affix.familyId || ![1, 2, 3].includes(affix.tier) ||
          !Number.isSafeInteger(affix.roll) || affix.roll < 0) throw new TypeError('Invalid saved affix')
      if (families.some(family => family.id === affix.familyId)) continue
      const family = families.find(family => family.category === affix.category && family.roles.includes(item.role))
      const tier = family?.tiers.find(tier => tier.tier === 1)
      if (!family || !tier) throw new TypeError('Missing replacement affix')
      refunds.push(`Replaced ${affix.familyId} on item ${item.id} with ${family.name}.`)
      Object.assign(affix, { familyId: family.id, tier: 1, roll: tier.min })
    }
  }
}

/** Update a detached older M2 projection for a legacy controller. */
export function refundRemovedContent(data: CharacterData, content: M2Content): string[] {
  if (data.contentVersion === content.version) return []
  if (/^m\d+-v\d+$/.test(data.contentVersion) && data.contentVersion !== 'm2-v1') throw new TypeError('Invalid source content version')
  const refunds: string[] = []
  refundGraphAndItems(data.character, content, refunds)
  refundLegacyDrawings(data.character, content, refunds)
  data.contentVersion = content.version
  return refunds
}

const changedDrawings: Record<string, string> = {
  'span-cut': 'build seams with successive hits',
  'plinth-blow': 'hold and release to charge the stamp',
  'fold-dart': 'apply Burden with a tally dart',
  'rill-fan': 'hold to channel steerable pulses'
}

/** M2 drawings and folds cost no points. Keep their receipt separate from graph refunds. */
export function migrateDrawings(character: CharacterState, content: M3Content, refunds: string[]) {
  const loadout = repairLoadout(character, content, 'migration')
  for (const [i, skill] of character.loadout.entries()) {
    if (!skill) continue
    const action = content.actions.find(a => a.id === skill)
    if (!action) refunds.push(`Retired drawing ${skill}.`)
    else if (loadout[i] !== skill) refunds.push(`Cleared ${skill}, which requires ${action.familyId}.`)
    else refunds.push(`Kept ${skill}. Its new drawing lets you ${changedDrawings[skill]}.`)
  }
  character.loadout = loadout
  for (const [skill, folds] of Object.entries(character.folds)) {
    const retained = folds.filter(id => {
      if (id === 'splay-pleat' && skill === 'fold-dart' && content.folds.some(f => f.id === id && f.whitelist.includes(skill))) return true
      refunds.push(`Removed ${id} from ${skill}, releasing its tension.`)
      return false
    })
    if (content.actions.some(a => a.id === skill)) character.folds[skill] = retained
    else delete character.folds[skill]
  }
}
