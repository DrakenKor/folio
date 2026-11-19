import { validateRetainedFolds } from '../combat/build'
import { isM3 } from '../core/profile'
import type { CharacterState, Entity, Operation, OperationReason, WeaponFamily, World } from '../core/types'
import { repairLoadout, weaponFamily } from './loadout'

const CAPACITY = 30
const PICKUP_RANGE_SQUARED = 1.5 * 1.5

function distanceSquared(a: Entity['pos'], b: Entity['pos']) {
  const dx = a.x - b.x, dz = a.z - b.z
  return dx * dx + dz * dz
}

export function pickup(world: World, player: Entity, id: number): OperationReason | null {
  const index = world.groundDrops.findIndex(drop => drop.item.id === id)
  const drop = world.groundDrops[index]
  if (!drop) return 'unknown-item'
  if (distanceSquared(player.pos, drop.pos) > PICKUP_RANGE_SQUARED) return 'out-of-range'
  const character = player.character!
  if (character.inventory.length >= CAPACITY) return 'inventory-full'
  character.items.push(drop.item)
  character.inventory.push(id)
  world.groundDrops.splice(index, 1)
  return null
}

export function pickupNearest(world: World, player: Entity) {
  let nearest: number | undefined
  let best = PICKUP_RANGE_SQUARED
  for (const drop of world.groundDrops) {
    const distance = distanceSquared(player.pos, drop.pos)
    if (distance < best || (distance === best && (nearest === undefined || drop.item.id < nearest))) {
      best = distance
      nearest = drop.item.id
    }
  }
  if (nearest !== undefined) pickup(world, player, nearest)
}

export function moveItem(character: CharacterState, edit: Extract<Operation, { type: 'stash' | 'discard' }>): OperationReason | null {
  const source = character[edit.from]
  const index = source.indexOf(edit.itemId)
  if (index < 0) return 'unknown-item'
  if (edit.type === 'stash') {
    const to = edit.from === 'inventory' ? 'stash' : 'inventory'
    if (character[to].length >= CAPACITY) return to === 'stash' ? 'stash-full' : 'inventory-full'
    character[to].push(edit.itemId)
  } else character.items = character.items.filter(item => item.id !== edit.itemId)
  source.splice(index, 1)
  return null
}

export function changeEquipment(world: World, player: Entity, edit: Extract<Operation, { type: 'equip' | 'unequip' }>): OperationReason | null {
  const character = player.character!
  const { inventory, stash } = character
  const item = edit.type === 'equip' ? character.items.find(item => item.id === edit.itemId) : null
  const role = edit.type === 'unequip' ? edit.role : item?.role
  if (!role) return 'unknown-item'
  const previous = character.equipment[role]
  const next = item?.id ?? null
  let source: number[] | null = null
  let index = -1
  if (next === null) {
    if (role === 'weapon') return 'weapon-required'
    if (previous === null) return 'unknown-item'
  } else {
    source = inventory.includes(next) ? inventory : stash
    index = source.indexOf(next)
    if (index < 0) return 'unknown-item'
  }
  if (previous !== null && source !== inventory && inventory.length >= CAPACITY) return 'inventory-full'
  const equipment = { ...character.equipment, [role]: next }
  const result = validateRetainedFolds(world, { ...player, character: { ...character, equipment } })
  if (!result.accepted) return result.reason

  if (source === inventory && previous !== null) inventory[index] = previous
  else {
    source?.splice(index, 1)
    if (previous !== null) inventory.push(previous)
  }
  const content = isM3(world) ? world.content.m3 : undefined
  const previousFamily = content && weaponFamily(character, content)
  character.equipment = equipment
  if (content && previousFamily !== weaponFamily(character, content)) character.loadout = repairLoadout(character, content, 'family')
  else if (content && role === 'survey-tally' && next === null) character.loadout = repairLoadout(character, content, 'tally')
  return null
}

export function refitWeapon(world: World, character: CharacterState, family: WeaponFamily): OperationReason | null {
  if (!isM3(world)) return 'unsupported'
  const content = world.content.m3
  const base = content.itemBases.find(b => b.role === 'weapon' && b.familyId === family)
  if (!base) return 'wrong-family'
  const item = character.items.find(i => i.id === character.equipment.weapon)
  if (!item) return 'weapon-required'
  if (weaponFamily(character, content) !== family) {
    item.baseId = base.id
    character.loadout = repairLoadout(character, content, 'family')
  }
  return null
}
