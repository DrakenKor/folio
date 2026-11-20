import {
  BufferGeometry, CanvasTexture, Color, DoubleSide, Group, Mesh, MeshBasicNodeMaterial,
  OctahedronGeometry, Sprite, SpriteNodeMaterial, Vector3
} from 'three/webgpu'
import { TICK_DT, type Entity, type Footprint, type M3World, type OwnedEffect, type Vec2 } from '../../sim/core/types'
import type { Heightfield } from '../terrain/heightfield'
import type { Frame } from '../view'
import { disposeInk, inkShape, makeInk, offset, perimeter, updateGeometry, type Ink } from './ground-ink'

const palettes = {
  danger: [0xc24732, 0xffc079],
  seam: [0x95482c, 0xffdda0],
  charge: [0xa8763f, 0xffebac],
  chalk: [0x707a68, 0xfbeec9],
  heat: [0xe48436, 0xffc377],
  echo: [0x777b51, 0xf2e4a3],
  spent: [0x7b796e, 0xeee5cf]
} as const

type Palette = keyof typeof palettes
type Entry = { ink: Ink; vertices: string }
type Aftermath = { effect: OwnedEffect; tick: number; text: string; label?: Sprite }

const disc = (origin: Vec2, radius: number): Footprint =>
  ({ kind: 'disc', origin, radius, direction: 0, reach: 0, halfWidth: 0, arcRadians: 0 })
const centerOf = (f: Footprint) => f.kind === 'lane' ? offset(f.origin, f.direction, f.reach / 2) : f.origin
const hitLife = 22

/** Ink on the meadow follows the same committed geometry and timing as M3 contacts. */
export class M3Feedback {
  readonly object = new Group()
  private readonly ink = new Map<string, Entry>()
  private readonly live = new Set<string>()
  private readonly previous = new Map<number, OwnedEffect>()
  private readonly aftermath = new Map<number, Aftermath>()
  private readonly thread = new Mesh(new BufferGeometry(), new MeshBasicNodeMaterial({
    color: 0xfad69c, side: DoubleSide, depthWrite: false
  }))
  private readonly eye = new Mesh(new OctahedronGeometry(.14), new MeshBasicNodeMaterial({ color: 0xffe6ab }))
  private world: Readonly<M3World> | null = null
  private tick = -1

  constructor(private readonly field: Heightfield) {
    this.object.name = 'm3-combat-feedback'
    this.object.add(this.eye, this.thread)
    this.thread.renderOrder = 2
    this.eye.renderOrder = 3
  }

  sync(frame: Frame, world: Readonly<M3World>, player: Entity, hand: Vector3): void {
    if (this.world !== world || this.tick > world.tick) this.clear()
    this.world = world
    this.tick = world.tick
    this.live.clear()
    this.eye.visible = this.thread.visible = false
    const time = world.tick + frame.alpha
    const cards = world.content.m3.actions
    const effects = new Set<number>()
    for (const e of world.effects) {
      effects.add(e.id)
      const key = 'effect-' + e.id
      const f = e.footprint
      const progress = Math.max(0, Math.min(1, (time - e.startTick) / Math.max(1, e.dueTick - e.startTick)))
      switch (e.kind) {
        case 'warning':
          this.shape(key, f, 'danger', .19 + progress * .39, .92, .085)
          break
        case 'eye':
          if (e.ownerId === player.id) this.reel(e, time, hand)
          break
        case 'tile': {
          const rim = world.content.m3.folds.find(fold => e.recipe.folds.includes(fold.id) && fold.mechanic.kind === 'rim')?.mechanic
          const armed = e.leg === 1 && world.tick >= e.dueTick
          const heat = armed ? .55 : .12 + progress * .19
          const pieces = rim?.kind === 'rim' ? [-rim.offset, rim.offset].map(side =>
            ({ ...f, origin: offset(f.origin, f.direction, 0, side), radius: rim.tileRadius })) : [f]
          for (const [i, piece] of pieces.entries()) {
            this.shape(key + '-' + i, piece, 'heat', heat, armed ? 1 : .62, armed ? .11 : .055, true)
          }
          break
        }
        case 'counter':
          if (e.recipe.skillId === 'brace-mark' && !e.acceptedTargetIds.length) {
            this.shape(key, { ...f, reach: .68 }, 'chalk', .15, 1, .07)
            this.shape(key + '-heel', { ...f, kind: 'lane', origin: offset(f.origin, f.direction, .53, -.22),
              direction: f.direction + Math.PI / 2, reach: .44, halfWidth: .035 }, 'chalk', .75, 1, .04)
          }
          break
        case 'echo':
          this.shape(key, f, e.recipe.skillId === 'open-hem' ? 'seam' : 'echo', .12 + progress * .16, .86, .058)
          break
        case 'mark':
          this.shape(key, f, 'chalk', .11, .92, .075)
          this.rune(key + '-rune', f.origin, f.direction, .38, .88)
          break
        case 'impression':
          this.aftermath.set(e.id, { effect: e, tick: world.tick, text: '' })
          break
      }
      this.previous.set(e.id, e)
    }
    for (const [id, e] of this.previous) {
      if (effects.has(id)) continue
      this.previous.delete(id)
      const owner = world.entities.find(a => a.id === e.ownerId)
      if (!owner || owner.death || world.encounter?.phase !== 'active') continue
      if (e.recipe.skillId === 'brace-mark' && e.kind === 'counter' && !e.acceptedTargetIds.length &&
        owner.action?.id === 'brace-mark' && owner.action.ageTicks >= owner.action.recipe!.timing.windupTicks + owner.action.recipe!.timing.activeTicks) {
        this.aftermath.set(id, { effect: e, tick: world.tick, text: 'Brace missed' })
      } else if ((e.kind === 'warning' || e.kind === 'echo' && e.recipe.skillId !== 'open-hem') &&
        e.dueTick <= world.tick && world.tick - e.dueTick < hitLife) {
        const landed = frame.events.some(event => event.type === 'hit' && event.tick === e.dueTick &&
          event.actorId === e.ownerId && event.skillId === e.recipe.skillId && event.actionStartTick === e.startTick)
        this.aftermath.set(id, { effect: e, tick: e.dueTick, text: landed ? '' : e.kind === 'warning' ? 'Missed' : 'Echo missed' })
      }
    }
    for (const [id, impact] of this.aftermath) {
      const age = time - impact.tick
      if (age >= hitLife || world.encounter?.phase === 'rest') {
        this.removeLabel(impact)
        this.aftermath.delete(id)
        continue
      }
      const { effect: e, text } = impact
      const f = e.kind === 'counter' ? disc(e.footprint.origin, .63) : e.footprint
      const anchor = f.kind === 'sector' ? offset(f.origin, f.direction, f.reach * .72) : centerOf(f)
      const opacity = Math.max(0, 1 - age / hitLife)
      this.shape('spent-' + id, f, text ? 'spent' : e.kind === 'warning' ? 'danger' : 'heat',
        opacity * (text ? .10 : .43), opacity * .85, .058, e.kind === 'impression')
      if (text) {
        this.rune('miss-' + id, anchor, f.direction, .27, opacity)
        impact.label ??= this.label(text)
        impact.label.position.copy(this.ground(anchor, (e.kind === 'counter' ? 1.85 : .88) + age * .011))
        impact.label.material.opacity = Math.min(1, opacity * 2.3)
      }
    }
    const held = player.mechanics?.held
    const action = player.action
    const mechanic = cards.find(a => a.id === action?.id)?.mechanic
    const facing = action?.direction ?? player.facing
    const seams = player.mechanics?.counter?.value ?? 0
    if (!player.death) {
      for (let i = 0; i < 2; i++) {
        const cutting = action?.id === 'open-hem'
        if (i >= seams && !cutting) continue
        const origin = offset(player.pos, facing, .34, (i ? 1 : -1) * .75)
        this.shape('seam-' + i, { ...disc(origin, 0), kind: 'lane', direction: facing + (i ? -.44 : .44),
          reach: cutting ? 1.02 : .74, halfWidth: .042 }, 'seam', .9, .96, .048)
      }
      if (held?.kind === 'charge' && mechanic?.kind === 'plinth-blow' && action?.recipe) {
        const progress = Math.min(1, held.eligibleTicks / mechanic.chargedAt)
        const charged = progress === 1
        this.shape('charge', disc(player.pos, action.recipe.footprint.reach), 'charge',
          charged ? .32 : .1, charged ? .98 : .46, charged ? .09 : .035)
        for (let i = 0; i < 4; i++) {
          const a = facing + i * Math.PI / 2
          const origin = offset(player.pos, a, 1.18 - progress * .42)
          this.shape('heel-' + i, { ...disc(origin, 0), kind: 'lane', direction: a + Math.PI / 2,
            halfWidth: .065, reach: .28 }, 'charge', .74, .88, .04)
        }
      }
      if (action?.recipe && action.ageTicks >= action.recipe.timing.windupTicks &&
        action.ageTicks < action.recipe.timing.windupTicks + action.recipe.timing.activeTicks &&
        mechanic?.kind === 'plinth-blow' && !held) {
        this.shape('stamp', disc(player.pos, action.recipe.footprint.reach), 'charge', .48, 1, .11)
      }
    }
    for (const [key, entry] of this.ink) if (!this.live.has(key)) {
      disposeInk(entry.ink)
      this.ink.delete(key)
    }
  }

  private reel(e: OwnedEffect, time: number, hand: Vector3) {
    const f = e.footprint
    const distance = e.leg === 2 ? 0 : Math.min(f.reach, Math.max(0, time - e.dueTick + 1) * e.recipe.footprint.speed * TICK_DT)
    const point = offset(f.origin, f.direction, distance)
    const returning = e.recipe.skillId === 'gather-line'
    const p = this.ground(point, e.leg === 2 ? .25 : .34)
    this.eye.visible = true
    this.eye.position.copy(p)
    this.eye.rotation.set(.35, time * .11, Math.PI / 4)
    this.eye.scale.setScalar(returning ? 1.2 : 1)
    this.shape('eye-heel', disc(point, .24), 'seam', .25, .9, .05)

    const end = returning && e.endpoint ? this.ground(e.endpoint, .12) : hand
    const segments = returning ? 1 : 12
    const bow = new Vector3()
    const points = Array.from({ length: segments + 1 }, (_, i) => {
      const t = i / segments
      bow.copy(p).lerp(end, t)
      const floor = this.field.heightAt(bow.x, bow.z) + .13
      bow.y = Math.max(floor, bow.y - Math.sin(Math.PI * t) * .26)
      return bow.clone()
    })
    if (returning && end.distanceTo(hand) < .65) points.push(hand)
    const thread: number[] = []
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1]!, b = points[i]!
      const angle = Math.atan2(b.z - a.z, b.x - a.x)
      const half = returning ? .034 : .021
      const dx = Math.sin(angle) * half, dz = Math.cos(angle) * half
      thread.push(a.x - dx, a.y, a.z + dz, b.x - dx, b.y, b.z + dz, b.x + dx, b.y, b.z - dz,
        a.x - dx, a.y, a.z + dz, b.x + dx, b.y, b.z - dz, a.x + dx, a.y, a.z - dz)
    }
    updateGeometry(this.thread.geometry, thread)
    this.thread.material.color.setHex(returning ? 0xffedd0 : 0xf4bc75)
    this.thread.visible = true
  }

  private shape(key: string, footprint: Footprint, palette: Palette, fill: number, edge: number, width: number, rectangle = false) {
    this.live.add(key)
    let entry = this.ink.get(key)
    const [body, rim] = palettes[palette]
    if (!entry) {
      entry = { ink: makeInk(body, rim, palette === 'danger' ? 3 : 1), vertices: '' }
      this.ink.set(key, entry)
      this.object.add(entry.ink)
    }
    const { ink } = entry
    const vertices = JSON.stringify([footprint, width, rectangle])
    if (entry.vertices !== vertices) {
      inkShape(ink, this.field, perimeter(footprint, rectangle), centerOf(footprint), width)
      entry.vertices = vertices
    }
    ink.fill.material.opacity = fill
    ink.edge.material.opacity = edge
  }

  private rune(key: string, at: Vec2, direction: number, reach: number, opacity: number) {
    for (let i = 0; i < 2; i++) {
      const a = direction + (i ? -1 : 1) * Math.PI / 4
      this.shape(key + i, { ...disc(offset(at, a, -reach), 0), kind: 'lane',
        direction: a, reach: reach * 2, halfWidth: .023 }, 'chalk', opacity, opacity, .022)
    }
  }

  private label(text: string) {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 56
    const context = canvas.getContext('2d')!
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.font = '600 34px Georgia'
    context.lineWidth = 6
    context.strokeStyle = '#363736'
    context.strokeText(text, 128, 28)
    context.fillStyle = '#fff1d1'
    context.fillText(text, 128, 28)
    const label = new Sprite(new SpriteNodeMaterial({
      map: new CanvasTexture(canvas), depthTest: false, depthWrite: false, transparent: true, color: new Color(0xffffff)
    }))
    label.scale.set(1.56, .34, 1)
    label.renderOrder = 5
    this.object.add(label)
    return label
  }

  private ground(p: Vec2, lift: number) {
    const x = p.x + this.field.player.x, z = p.z + this.field.player.z
    return new Vector3(x, this.field.heightAt(x, z) + lift, z)
  }

  private removeLabel(impact: Aftermath) {
    impact.label?.removeFromParent()
    impact.label?.material.map?.dispose()
    impact.label?.material.dispose()
  }

  clear(): void {
    this.previous.clear()
    this.aftermath.forEach(impact => this.removeLabel(impact))
    this.aftermath.clear()
    this.ink.forEach(({ ink }) => disposeInk(ink))
    this.ink.clear()
    this.eye.visible = this.thread.visible = false
    this.world = null
  }

  dispose(): void {
    this.clear()
    this.thread.geometry.dispose()
    this.thread.material.dispose()
    this.eye.geometry.dispose()
    this.eye.material.dispose()
    this.object.removeFromParent()
  }
}
