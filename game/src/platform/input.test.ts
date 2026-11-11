// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { Button, createWorld, spawnEntity, step } from '../sim/core/index'
import { HeldInput, Input } from './input'

const basis = () => ({ forward: { x: 0, z: -1 }, right: { x: 1, z: 0 } })
let input: Input | undefined
afterEach(() => { input?.dispose(); document.body.replaceChildren(); Reflect.deleteProperty(document, 'hidden') })

function browserInput() {
  const canvas = document.createElement('canvas')
  document.body.append(canvas)
  input = new Input(canvas, basis, () => ({ x: 2, z: 3 }))
  return input
}

const pointer = (type: string, button: number) => {
  const target = type === 'pointerdown' ? document.querySelector('canvas')! : window
  target.dispatchEvent(new MouseEvent(type, { button, clientX: 20, clientY: 30 }))
}

describe('input', () => {
  it.each([
    ['primary', Button.Primary, 0], ['secondary', Button.Secondary, 2], ['Space', Button.Dodge, 'Space'],
    ['Q', Button.Skill1, 'KeyQ'], ['1', Button.Skill1, 'Digit1'], ['2', Button.Skill2, 'Digit2'],
    ['3', Button.Skill3, 'Digit3'], ['4', Button.Skill4, 'Digit4'], ['E', Button.Interact, 'KeyE']
  ])('maps %s and consumes a brief press exactly once', (_name, bit, code) => {
    const controls = browserInput()
    const world = createWorld(7)
    if (typeof code === 'number') { pointer('pointerdown', code); pointer('pointerup', code) }
    else {
      window.dispatchEvent(new KeyboardEvent('keydown', { code }))
      window.dispatchEvent(new KeyboardEvent('keyup', { code }))
    }
    expect(controls.command(world).buttons).toBe(bit)
    expect(controls.command(world).buttons).toBe(0)
  })

  it('preserves a brief movement press, held buttons and world-space pointer aim', () => {
    const controls = browserInput()
    const world = createWorld(7)
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }))
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }))
    pointer('pointerdown', 0)
    expect(controls.command(world)).toEqual({ move: { x: 0, z: -1 }, aim: { x: 2, z: 3 }, buttons: Button.Primary })
    expect(controls.command(world)).toEqual({ move: { x: 0, z: 0 }, aim: { x: 2, z: 3 }, buttons: Button.Primary })
    pointer('pointerup', 0)
    expect(controls.command(world).buttons).toBe(0)
    const menu = new MouseEvent('contextmenu', { cancelable: true })
    document.querySelector('canvas')!.dispatchEvent(menu)
    expect(menu.defaultPrevented).toBe(true)
  })

  it('copies and validates a queued command, overrides one tick and consumes pending live input', () => {
    const controls = browserInput()
    const world = createWorld(7)
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }))
    pointer('pointerdown', 0); pointer('pointerup', 0)
    const command = { move: { x: 1, z: 0 }, aim: { x: 10, z: 5 }, buttons: Button.Secondary }
    controls.queue(command)
    command.move.x = 99
    expect(() => controls.queue({ ...command, buttons: 256 })).toThrow('Invalid command')
    expect(controls.command(world)).toEqual({ ...command, move: { x: 1, z: 0 } })
    expect(controls.command(world)).toEqual({ move: { x: 0, z: -1 }, aim: { x: 2, z: 3 }, buttons: 0 })
    controls.queue(command)
    controls.queue({ move: { x: 0, z: 0 }, aim: null, buttons: 0 })
    expect(controls.command(world).buttons).toBe(0)
  })

  it('normalizes camera-relative diagonals and combines buttons', () => {
    const held = new HeldInput()
    held.keys = new Set(['KeyW', 'KeyD', 'Space', 'Digit3'])
    held.mouseButtons = Button.Primary
    const command = held.command(basis())
    expect(command.move.x).toBeCloseTo(Math.SQRT1_2)
    expect(command.move.z).toBeCloseTo(-Math.SQRT1_2)
    expect(command.buttons).toBe(Button.Primary | Button.Dodge | Button.Skill3)
  })

  it.each(['blur', 'hide'])('releases movement, buttons, aim and agent target on %s', async reason => {
    const controls = browserInput()
    const world = createWorld(7, 'test')
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }))
    pointer('pointerdown', 0)
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }))
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }))
    controls.queue({ move: { x: 1, z: 0 }, aim: null, buttons: Button.Secondary })
    controls.held.pointer = { x: 2, z: 3 }
    const arrival = controls.moveTo(4, 5)
    if (reason === 'blur') window.dispatchEvent(new Event('blur'))
    else {
      Object.defineProperty(document, 'hidden', { value: true, configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    }
    expect(controls.command(world)).toEqual({ move: { x: 0, z: 0 }, aim: null, buttons: 0 })
    await expect(arrival).resolves.toBe(false)
  })

  it('disables live gameplay for a dead player while consuming explicit commands', () => {
    const controls = browserInput()
    const world = createWorld(7)
    spawnEntity(world, { kind: 'player', pos: { x: 0, z: 0 }, radius: 0.4,
      health: 0, death: { startTick: 0, ageTicks: 0, despawnAfterTicks: null } })
    pointer('pointerdown', 0)
    expect(controls.command(world)).toEqual({ move: { x: 0, z: 0 }, aim: null, buttons: 0 })
    expect(controls.held.mouseButtons).toBe(0)
    const command = { move: { x: 1, z: 0 }, aim: null, buttons: Button.Dodge }
    controls.queue(command)
    expect(controls.command(world)).toEqual(command)
  })

  it('lets the agent override held movement, arrive, and time out after 600 ticks', async () => {
    const controls = browserInput()
    const world = createWorld(7, 'test')
    const player = spawnEntity(world, { kind: 'player', pos: { x: 0, z: 0 }, radius: 0.4 })
    controls.held.keys.add('KeyW')
    const arrival = controls.moveTo(2, 0)
    while (player.pos.x < 1.5) { step(world, controls.command(world)); controls.afterStep(world) }
    await expect(arrival).resolves.toBe(true)
    expect(player.pos.z).toBe(0)
    expect(player.pos.x).toBeGreaterThanOrEqual(1.5)
    const timeout = controls.moveTo(1000, 0)
    for (let i = 0; i < 600; i++) { step(world, controls.command(world)); controls.afterStep(world) }
    await expect(timeout).resolves.toBe(false)
  })
})
