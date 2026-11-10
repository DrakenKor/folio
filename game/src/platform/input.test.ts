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

describe('input', () => {
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
    controls.held.mouseButtons = Button.Primary
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
