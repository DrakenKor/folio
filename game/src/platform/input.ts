import { Button } from '../sim/core/index'
import type { Command, Vec2, World } from '../sim/core/index'

interface Basis { forward: Vec2; right: Vec2 }
const KEY_BUTTONS: Record<string, number> = {
  Space: Button.Dodge, KeyQ: Button.Skill1, Digit1: Button.Skill1,
  Digit2: Button.Skill2, Digit3: Button.Skill3, Digit4: Button.Skill4, KeyE: Button.Interact
}
const MOVEMENT_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD']

/** Held input is independent of DOM events so release behaviour can be tested. */
export class HeldInput {
  keys = new Set<string>()
  mouseButtons = 0
  pointer: Vec2 | null = null

  release(): void { this.keys.clear(); this.mouseButtons = 0; this.pointer = null }

  command(basis: Basis): Command {
    const forward = Number(this.keys.has('KeyW')) - Number(this.keys.has('KeyS'))
    const right = Number(this.keys.has('KeyD')) - Number(this.keys.has('KeyA'))
    const length = Math.max(1, Math.hypot(forward, right))
    let buttons = this.mouseButtons
    for (const key of this.keys) buttons |= KEY_BUTTONS[key] ?? 0
    return {
      move: { x: (forward * basis.forward.x + right * basis.right.x) / length,
        z: (forward * basis.forward.z + right * basis.right.z) / length },
      aim: this.pointer ? { ...this.pointer } : null, buttons
    }
  }
}

/** Converts browser input and a straight-line agent target into tick commands. */
export class Input {
  readonly held = new HeldInput()
  private listeners = new AbortController()
  private pointer: { x: number; y: number } | null = null
  private target: { x: number; z: number; ticks: number; resolve: (arrived: boolean) => void } | null = null

  constructor(canvas: HTMLCanvasElement, private basis: () => Basis,
    private groundPoint: (x: number, y: number) => Vec2 | null) {
    const options = { signal: this.listeners.signal }
    window.addEventListener('keydown', event => {
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, button')) return
      if (MOVEMENT_KEYS.includes(event.code) || event.code in KEY_BUTTONS) {
        event.preventDefault()
        this.held.keys.add(event.code)
      }
    }, options)
    window.addEventListener('keyup', event => this.held.keys.delete(event.code), options)
    canvas.addEventListener('pointermove', event => { this.pointer = { x: event.clientX, y: event.clientY } }, options)
    canvas.addEventListener('pointerleave', () => { this.pointer = null; this.held.pointer = null }, options)
    canvas.addEventListener('pointerdown', event => {
      canvas.focus()
      this.pointer = { x: event.clientX, y: event.clientY }
      this.held.mouseButtons |= event.button === 0 ? Button.Primary : event.button === 2 ? Button.Secondary : 0
    }, options)
    window.addEventListener('pointerup', event => {
      this.held.mouseButtons &= ~(event.button === 0 ? Button.Primary : event.button === 2 ? Button.Secondary : 0)
    }, options)
    canvas.addEventListener('contextmenu', event => event.preventDefault(), options)
    window.addEventListener('blur', () => this.release(), options)
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.release() }, options)
  }

  command(world: World): Command {
    this.held.pointer = this.pointer ? this.groundPoint(this.pointer.x, this.pointer.y) : null
    const command = this.held.command(this.basis())
    if (this.target) {
      const player = world.entities.find(entity => entity.id === world.playerId)
      if (!player) this.finish(false)
      else {
        const dx = this.target.x - player.pos.x
        const dz = this.target.z - player.pos.z
        const distance = Math.hypot(dx, dz)
        if (distance <= 0.5) this.finish(true)
        else command.move = { x: dx / distance, z: dz / distance }
      }
      // The arrival tick must not fall back to held keyboard movement.
      if (!this.target) command.move = { x: 0, z: 0 }
    }
    return command
  }

  afterStep(world: World): void {
    if (!this.target) return
    const player = world.entities.find(entity => entity.id === world.playerId)
    this.target.ticks++
    if (player && Math.hypot(player.pos.x - this.target.x, player.pos.z - this.target.z) <= 0.5) this.finish(true)
    else if (!player || this.target.ticks >= 600) this.finish(false)
  }

  moveTo(x: number, z: number): Promise<boolean> {
    if (!Number.isFinite(x) || !Number.isFinite(z)) throw new TypeError('Coordinates must be finite')
    this.finish(false)
    return new Promise(resolve => { this.target = { x, z, ticks: 0, resolve } })
  }

  release(): void { this.held.release(); this.pointer = null; this.finish(false) }
  dispose(): void { this.release(); this.listeners.abort() }

  private finish(arrived: boolean): void {
    this.target?.resolve(arrived)
    this.target = null
  }
}
