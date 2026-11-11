import { BufferAttribute, BufferGeometry, CanvasTexture, DoubleSide, Group, Mesh, MeshBasicNodeMaterial, Sprite, SpriteNodeMaterial, Vector3, type Camera, type Object3D } from 'three/webgpu'
import type { Entity, SimEvent, World } from '../../sim/core/types'
import type { Heightfield } from '../terrain/heightfield'
import type { Frame } from '../view'
import { isCelMaterial } from '../materials/cel'

const NUMBER_TICKS = 30

interface Burst { key: string; targetId: number; tick: number; object: Group; number: Sprite; texture: CanvasTexture }

/** Disposable contact history; persistent flashes and attack footprints come from state. */
export class CombatFeedback {
  readonly object = new Group()
  private world: Readonly<World> | null = null
  private bursts: Burst[] = []
  private seen = new Map<string, number>()
  private footprints = new Map<number, Group>()
  private darts = new Map<number, Group>()
  private trails = new Map<number, Group>()
  private readonly fragmentGeometry = new BufferGeometry().setAttribute('position', new BufferAttribute(new Float32Array([
    0, 0.1, 0, -0.04, 0, 0, 0, -0.06, 0.04, 0.04, 0, 0, 0, 0.1, 0, 0, -0.06, 0.04
  ]), 3))
  private readonly fragmentMaterial = new MeshBasicNodeMaterial({ color: 0xf5ddb0, side: DoubleSide })

  constructor(private field: Heightfield) { this.object.name = 'combat-feedback' }

  sync(frame: Frame): void {
    if (this.world !== frame.world) { this.clear(); this.world = frame.world }
    const { world } = frame
    const time = world.tick + frame.alpha
    for (const [key, tick] of this.seen) if (world.tick - tick >= NUMBER_TICKS) this.seen.delete(key)
    for (const event of frame.events) if (event.type === 'damage' && world.tick - event.tick < NUMBER_TICKS) this.contact(event)
    this.bursts = this.bursts.filter(burst => {
      const age = time - burst.tick
      if (age < 0 || age >= NUMBER_TICKS) { this.removeBurst(burst); return false }
      burst.number.material.opacity = Math.min(1, (NUMBER_TICKS - age) / 8)
      burst.object.children.slice(1).forEach((piece, i) => {
        const a = i * Math.PI * 0.5 + 0.4
        piece.visible = age < 12
        piece.position.set(Math.cos(a) * age * 0.035, 0.45 + Math.sin(age / 12 * Math.PI) * 0.28, Math.sin(a) * age * 0.035)
        piece.rotation.set(age * 0.1, a, age * 0.08)
      })
      return true
    })
    const live = new Set<number>()
    const dodging = new Set<number>()
    for (const actor of world.entities) {
      const action = actor.action
      if (!actor.death && action?.kind === 'dodge') {
        dodging.add(actor.id)
        this.dodge(actor, world.content.dodge.timing.activeTicks, world.content.dodge.distance)
      }
      const skill = world.content.skills.find(skill => skill.id === action?.id)
      const age = action?.ageTicks ?? 0
      const warning = actor.ai && skill?.kind === 'melee' && age < skill.timing.windupTicks
      const cut = !actor.ai && skill?.kind === 'melee' && age >= skill.timing.windupTicks && age < skill.timing.windupTicks + skill.timing.activeTicks
      if (!actor.death && action && skill?.kind === 'melee' && (warning || cut)) {
        live.add(actor.id)
        let footprint = this.footprints.get(actor.id)
        if (!footprint) {
          footprint = new Group()
          const fill = new Mesh(new BufferGeometry(), new MeshBasicNodeMaterial({ color: 0x985027,
            transparent: true, opacity: 0.5, depthWrite: false, depthTest: !!warning, side: DoubleSide }))
          const rim = new Mesh(new BufferGeometry(), new MeshBasicNodeMaterial({ color: warning ? 0xffd17a : 0xffe4ab,
            transparent: true, opacity: 0.95, depthWrite: false, depthTest: !!warning, side: DoubleSide }))
          fill.renderOrder = warning ? -2 : 1
          rim.renderOrder = warning ? -1 : 2
          footprint.add(fill, rim)
          this.footprints.set(actor.id, footprint)
          this.object.add(footprint)
        }
        const [fill, rim] = footprint.children as [Mesh<BufferGeometry, MeshBasicNodeMaterial>, Mesh<BufferGeometry, MeshBasicNodeMaterial>]
        fill.visible = !!warning
        const progress = Math.min(1, (age + 1) / Math.max(1, skill.timing.windupTicks))
        fill.material.opacity = 0.45 + progress * 0.23
        this.sector(fill, actor, action.direction, skill.range, skill.arcRadians, 0)
        this.sector(rim, actor, action.direction, skill.range, skill.arcRadians, skill.range - (warning ? 0.11 : 0.065), !!warning)
      }
    }
    for (const [id, footprint] of this.footprints) if (!live.has(id)) { this.removeMeshGroup(footprint); this.footprints.delete(id) }
    for (const [id, trail] of this.trails) if (!dodging.has(id)) { this.removeMeshGroup(trail); this.trails.delete(id) }
    const flying = new Set<number>()
    for (const dart of world.projectiles) {
      flying.add(dart.id)
      let object = this.darts.get(dart.id)
      if (!object) {
        object = new Group()
        const geometry = new BufferGeometry().setAttribute('position', new BufferAttribute(new Float32Array([
          0.36, 0, 0, -0.18, 0.09, 0.12, -0.18, -0.07, 0,
          0.36, 0, 0, -0.18, -0.07, 0, -0.18, 0.09, -0.12,
          0.36, 0, 0, -0.18, 0.09, -0.12, -0.18, 0.09, 0.12
        ]), 3))
        const head = new Mesh(geometry, new MeshBasicNodeMaterial({ color: 0xffedc5, side: DoubleSide }))
        const tail = new Mesh(new BufferGeometry().setAttribute('position', new BufferAttribute(new Float32Array([
          -0.15, 0, -0.065, -0.85, 0, 0, -0.15, 0, 0.065
        ]), 3)), new MeshBasicNodeMaterial({ color: 0xd6ae65, transparent: true, opacity: 0.55, side: DoubleSide }))
        object.add(head, tail)
        this.darts.set(dart.id, object)
        this.object.add(object)
      }
      const x = dart.pos.x + this.field.player.x
      const z = dart.pos.z + this.field.player.z
      object.position.set(x, this.field.heightAt(x, z) + 0.7, z)
      object.rotation.y = -Math.atan2(dart.vel.z, dart.vel.x)
    }
    for (const [id, object] of this.darts) if (!flying.has(id)) { this.removeMeshGroup(object); this.darts.delete(id) }
  }

  /** New hits stay closest to their target; older hits stack upward, resolving nearby screen collisions too. */
  layout(camera: Camera): void {
    const placed: Array<{ x: number; y: number; w: number; h: number }> = []
    const player = this.world?.entities.find(actor => actor.id === this.world?.playerId)
    if (player) {
      const x = player.pos.x + this.field.player.x
      const z = player.pos.z + this.field.player.z
      const head = new Vector3(x, this.field.heightAt(x, z) + 1.65, z).applyMatrix4(camera.matrixWorldInverse)
      const sx = camera.projectionMatrix.elements[0]! / Math.max(0.1, -head.z)
      const sy = camera.projectionMatrix.elements[5]! / Math.max(0.1, -head.z)
      placed.push({ x: head.x * sx, y: head.y * sy, w: 0.4 * sx, h: 0.4 * sy })
    }
    const ordered = [...this.bursts].sort((a, b) => b.tick - a.tick || a.targetId - b.targetId)
    for (const burst of ordered) {
      const age = (this.world?.tick ?? burst.tick) - burst.tick
      const slot = ordered.filter(other => other.targetId === burst.targetId && other !== burst &&
        (other.tick > burst.tick || (other.tick === burst.tick && ordered.indexOf(other) < ordered.indexOf(burst)))).length
      const target = this.world?.entities.find(actor => actor.id === burst.targetId)
      const anchor = target ? new Vector3(target.pos.x + this.field.player.x, 0, target.pos.z + this.field.player.z) : burst.object.position.clone()
      anchor.y = this.field.heightAt(anchor.x, anchor.z)
      const height = burst.targetId === this.world?.playerId ? 2.25 : 1.1
      const p = anchor.add(new Vector3(0, height + age / 100 + slot * 0.36, 0)).applyMatrix4(camera.matrixWorldInverse)
      const depth = Math.max(0.1, -p.z)
      const sx = camera.projectionMatrix.elements[0]! / depth
      const sy = camera.projectionMatrix.elements[5]! / depth
      const rect = { x: p.x * sx, y: p.y * sy, w: burst.number.scale.x * sx * 0.42, h: burst.number.scale.y * sy * 0.52 }
      let overlap
      do {
        overlap = placed.find(other => Math.abs(other.x - rect.x) < other.w + rect.w && Math.abs(other.y - rect.y) < other.h + rect.h)
        if (overlap) rect.y = overlap.y + overlap.h + rect.h + 0.006
      } while (overlap)
      placed.push(rect)
      p.y = rect.y / sy
      burst.number.position.copy(p.applyMatrix4(camera.matrixWorld).sub(burst.object.position))
    }
  }

  /** Short layered streaks follow the actual dodge path and fade during recovery. */
  private dodge(actor: Entity, activeTicks: number, distance: number): void {
    const action = actor.action!
    let trail = this.trails.get(actor.id)
    if (!trail) {
      trail = new Group()
      trail.name = 'dodge-trail'
      trail.add(new Mesh(new BufferGeometry(), new MeshBasicNodeMaterial({ color: 0xe8d8ae,
        transparent: true, opacity: 0.45, depthWrite: false, side: DoubleSide })))
      this.object.add(trail)
      this.trails.set(actor.id, trail)
    }
    const mesh = trail.children[0] as Mesh<BufferGeometry, MeshBasicNodeMaterial>
    const d = { x: Math.cos(action.direction), z: Math.sin(action.direction) }
    const length = Math.min(1.5, distance * (action.ageTicks + 1) / activeTicks)
    const x = actor.pos.x + this.field.player.x
    const z = actor.pos.z + this.field.player.z
    const positions: number[] = []
    for (const [side, height] of [[-0.22, 0.16], [0, 0.5], [0.22, 0.22]]) {
      const point = (back: number, width: number) => {
        const px = x - d.x * back - d.z * (side! + width)
        const pz = z - d.z * back + d.x * (side! + width)
        return [px, this.field.heightAt(px, pz) + height!, pz]
      }
      positions.push(...point(0.25, -0.035), ...point(length, 0), ...point(0.25, 0.035))
    }
    const position = mesh.geometry.getAttribute('position')
    if (position) { position.array.set(positions); position.needsUpdate = true }
    else mesh.geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
    mesh.geometry.computeBoundingSphere()
    mesh.material.opacity = 0.5 * Math.min(1, Math.max(0, (activeTicks + 7 - action.ageTicks) / 7))
  }

  /** Tint the existing posed surface; never add a second actor transform or impulse. */
  flash(object: Object3D, actor: Entity): void {
    object.traverse(node => {
      if (!(node instanceof Mesh)) return
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
        const flash = actor.hitFlashTicks > 0 ? (actor.hitFlashTicks > 3 ? 0.5 : 0.2) : 0
        if (isCelMaterial(material)) material.emissive.setRGB(flash, flash * 0.85, flash * 0.62)
      }
    })
  }

  clear(): void {
    this.bursts.forEach(burst => this.removeBurst(burst))
    this.bursts = []
    this.seen.clear()
    for (const group of [...this.footprints.values(), ...this.darts.values(), ...this.trails.values()]) this.removeMeshGroup(group)
    this.footprints.clear()
    this.darts.clear()
    this.trails.clear()
  }

  dispose(): void {
    this.clear()
    this.fragmentGeometry.dispose()
    this.fragmentMaterial.dispose()
    this.object.removeFromParent()
  }

  private contact(event: Extract<SimEvent, { type: 'damage' }>): void {
    const key = `${event.tick}:${event.actorId}:${event.targetId}:${event.skillId}`
    if (this.seen.has(key)) return
    this.seen.set(key, event.tick)
    if (this.bursts.length === 16) this.removeBurst(this.bursts.shift()!)
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 64
    const context = canvas.getContext('2d')!
    context.font = '600 44px Georgia, serif'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.strokeStyle = '#413345'
    context.lineWidth = 5
    context.strokeText(String(event.amount), 64, 32)
    context.fillStyle = event.targetId === this.world?.playerId ? '#f1bd9d' : '#fff1cf'
    context.fillText(String(event.amount), 64, 32)
    const texture = new CanvasTexture(canvas)
    const number = new Sprite(new SpriteNodeMaterial({ map: texture, depthTest: false, depthWrite: false }))
    number.scale.set(0.8, 0.4, 1)
    number.renderOrder = 4
    const object = new Group()
    object.add(number)
    for (let i = 0; i < 4; i++) object.add(new Mesh(this.fragmentGeometry, this.fragmentMaterial))
    const x = event.position.x + this.field.player.x
    const z = event.position.z + this.field.player.z
    object.position.set(x, this.field.heightAt(x, z), z)
    this.object.add(object)
    this.bursts.push({ key, targetId: event.targetId, tick: event.tick, object, number, texture })
  }

  /** Conform the committed sector to the rendered terrain, including the two radial edges. */
  private sector(mesh: Mesh, actor: Entity, direction: number, range: number, arc: number, inner: number, edges = false): void {
    const positions: number[] = []
    const x = actor.pos.x + this.field.player.x
    const z = actor.pos.z + this.field.player.z
    const point = (r: number, a: number) => {
      const px = x + Math.cos(a) * r
      const pz = z + Math.sin(a) * r
      return [px, this.field.heightAt(px, pz) + 0.075, pz]
    }
    for (let i = 0; i < 28; i++) {
      const a = direction - arc / 2 + arc * i / 28
      const b = a + arc / 28
      positions.push(...point(inner, a), ...point(range, b), ...point(range, a),
        ...point(inner, a), ...point(inner, b), ...point(range, b))
    }
    if (inner > 0 && edges) for (const side of [-1, 1]) {
      const a = direction + side * arc / 2
      positions.push(...point(0.15, a - 0.018), ...point(range, a + 0.018), ...point(range, a - 0.018),
        ...point(0.15, a - 0.018), ...point(0.15, a + 0.018), ...point(range, a + 0.018))
    }
    const attribute = mesh.geometry.getAttribute('position')
    if (attribute?.count === positions.length / 3) { attribute.array.set(positions); attribute.needsUpdate = true }
    else mesh.geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
    mesh.geometry.computeBoundingSphere()
  }

  private removeBurst(burst: Burst): void {
    burst.object.removeFromParent()
    burst.number.material.dispose()
    burst.texture.dispose()
  }

  private removeMeshGroup(group: Group): void {
    group.removeFromParent()
    group.traverse(node => {
      if (!(node instanceof Mesh)) return
      node.geometry.dispose()
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) material.dispose()
    })
  }
}
