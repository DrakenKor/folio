import { validateRetainedFolds } from '../combat/build'
import type { CharacterState, Entity, Operation, OperationReason, World } from '../core/types'

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
  character.equipment = equipment
  return null
}
