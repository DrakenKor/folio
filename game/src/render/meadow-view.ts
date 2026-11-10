import { Mesh, NeutralToneMapping, PCFShadowMap, type Group, type WebGPURenderer } from 'three/webgpu'
import { bookmark, type BookmarkName } from '../look/bookmarks'
import { createEnemy } from '../look/standin'
import { TICK_DT, type World } from '../sim/core/types'
import { CameraRig } from './basic/camera'
import { CharacterView, loadCharacter, type CharacterAsset } from './characters/character'
import { createMeadow } from './meadow'
import { createPost } from './post/pipeline'
import type { Frame, RenderView } from './view'

interface GaitState { x: number; z: number; phase: number; previousPhase: number }

/** Tick-driven meadow presentation; simulation coordinates start at the meadow's player clearing. */
export class MeadowView implements RenderView {
  readonly camera: CameraRig
  private meadow
  private post
  private knight: CharacterView
  private dummies = new Map<number, Group>()
  private gaits = new Map<number, GaitState>()
  private world: Readonly<World> | null = null
  private tick = -1
  private framing: string | null | undefined

  static async create(renderer: WebGPURenderer, world: World): Promise<MeadowView> {
    const asset = await loadCharacter(`${import.meta.env.BASE_URL}pack/characters/knight.glb`)
    return new MeadowView(renderer, world, asset)
  }

  private constructor(private renderer: WebGPURenderer, world: World, readonly asset: CharacterAsset) {
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = PCFShadowMap
    renderer.toneMapping = NeutralToneMapping
    const pitch = 55 * Math.PI / 180
    const yaw = 20 * Math.PI / 180
    this.camera = new CameraRig(renderer.domElement, {
      position: { x: Math.sin(yaw) * Math.cos(pitch) * 17, y: 0.9 + Math.sin(pitch) * 17, z: Math.cos(yaw) * Math.cos(pitch) * 17 },
      target: { x: 0, y: 0.9, z: 0 }, fov: 40
    })
    this.camera.camera.far = 4000
    this.meadow = createMeadow(world.seed)
    this.knight = new CharacterView(asset)
    this.meadow.scene.add(this.knight.object)
    this.post = createPost(renderer, this.meadow.scene, this.camera.camera)
    this.registerBookmarks()
    this.advance(world)
  }

  /** Records distance at each simulation tick, including ticks stepped without rendering. */
  advance(world: Readonly<World>): void {
    if (world !== this.world || world.tick < this.tick) {
      this.gaits.clear()
      this.world = world
      this.tick = world.tick
    }
    for (const entity of world.entities) {
      if (entity.id !== world.playerId) continue
      const speed = Math.hypot(entity.vel.x, entity.vel.z)
      let gait = this.gaits.get(entity.id)
      if (!gait) {
        // Snapshots contain ticks and poses; a restored cycle starts at this reproducible anchor.
        const phase = world.tick * TICK_DT * this.knight.cycleRate(speed)
        gait = { ...entity.pos, phase, previousPhase: phase }
        this.gaits.set(entity.id, gait)
      } else if (world.tick !== this.tick) {
        const distance = Math.hypot(entity.pos.x - gait.x, entity.pos.z - gait.z)
        gait.previousPhase = gait.phase
        if (speed > 0) gait.phase += distance * this.knight.cycleRate(speed) / speed
        gait.x = entity.pos.x
        gait.z = entity.pos.z
      }
    }
    this.tick = world.tick
  }

  groundPoint(x: number, y: number) {
    const point = this.camera.groundPoint(x, y)
    return point ? { x: point.x - this.meadow.field.player.x, z: point.z - this.meadow.field.player.z } : null
  }

  sync(frame: Frame): void {
    if (frame.world.seed !== this.meadow.field.seed) {
      this.disposeScene()
      this.meadow = createMeadow(frame.world.seed)
      this.meadow.scene.add(this.knight.object)
      this.post = createPost(this.renderer, this.meadow.scene, this.camera.camera)
      this.registerBookmarks()
      this.framing = undefined
    }
    this.advance(frame.world)
    const present = new Set<number>()
    const time = (frame.world.tick + frame.alpha) * TICK_DT
    this.knight.object.visible = false
    for (const entity of frame.world.entities) {
      present.add(entity.id)
      const previous = frame.prev.get(entity.id) ?? { ...entity.pos, facing: entity.facing }
      const x = previous.x + (entity.pos.x - previous.x) * frame.alpha + this.meadow.field.player.x
      const z = previous.z + (entity.pos.z - previous.z) * frame.alpha + this.meadow.field.player.z
      const y = this.meadow.field.heightAt(x, z)
      const turn = Math.atan2(Math.sin(entity.facing - previous.facing), Math.cos(entity.facing - previous.facing))
      const facing = previous.facing + turn * frame.alpha
      if (entity.id === frame.world.playerId) {
        this.knight.object.visible = true
        this.knight.object.position.set(x, y, z)
        const gait = this.gaits.get(entity.id)!
        const interpolating = previous.x !== entity.pos.x || previous.z !== entity.pos.z
        const phase = interpolating ? gait.previousPhase + (gait.phase - gait.previousPhase) * frame.alpha : gait.phase
        if (entity.action && this.knight.clips.includes(entity.action.id)) {
          this.knight.poseClip(entity.action.id, time - entity.action.startTick * TICK_DT, facing)
        } else this.knight.pose({ speed: Math.hypot(entity.vel.x, entity.vel.z), facing, time, phase })
        const pose = bookmark('player', this.meadow.field)
        const ground = this.meadow.field.heightAt(this.meadow.field.player.x, this.meadow.field.player.z)
        this.camera.register('meadow-player', {
          position: { x: x + pose.position[0] - this.meadow.field.player.x, y: pose.position[1] + y - ground,
            z: z + pose.position[2] - this.meadow.field.player.z },
          target: { x, y: y + 0.9, z }, fov: pose.fov
        })
        if (this.camera.activeBookmark === 'meadow-player') this.camera.bookmark('meadow-player')
        this.camera.update({ x, y, z })
        this.meadow.setPlayer(x, z)
        if (this.camera.isFollowing || this.camera.activeBookmark === 'meadow-player') {
          this.meadow.grass.uniforms.cell.value = 0.2
          this.meadow.setFocus(x, z - 2, 28)
        }
      } else {
        let dummy = this.dummies.get(entity.id)
        if (!dummy) {
          dummy = createEnemy(this.meadow.env)
          this.dummies.set(entity.id, dummy)
          this.meadow.scene.add(dummy)
        }
        dummy.position.set(x, y, z)
        dummy.rotation.y = Math.PI / 2 - facing
        dummy.scale.setScalar(entity.radius / 0.4)
      }
    }
    for (const [id, dummy] of this.dummies) {
      if (!present.has(id)) { this.disposeObject(dummy); this.dummies.delete(id) }
    }
    const name = this.camera.activeBookmark
    if (name !== this.framing) {
      if (name?.startsWith('meadow-') && name !== 'meadow-player') {
        const pose = bookmark(name.slice(7) as BookmarkName, this.meadow.field)
        this.meadow.grass.uniforms.cell.value = pose.grassCell
        this.meadow.setFocus(...pose.focus, pose.shadowExtent)
      }
      this.framing = name
    }
    this.meadow.update(time, this.camera.camera)
  }

  render(): void { this.post.render() }

  resize(width: number, height: number, pixelRatio: number): void {
    this.renderer.setPixelRatio(pixelRatio)
    this.renderer.setSize(width, height, false)
    this.camera.camera.aspect = width / height
    this.camera.camera.updateProjectionMatrix()
  }

  dispose(): void { this.disposeScene(); this.knight.dispose() }

  private registerBookmarks(): void {
    for (const name of ['wide', 'player', 'monolith'] as const) {
      const pose = bookmark(name, this.meadow.field)
      const [x, y, z] = pose.position
      const [tx, ty, tz] = pose.target
      this.camera.register(`meadow-${name}`, { position: { x, y, z }, target: { x: tx, y: ty, z: tz }, fov: pose.fov })
    }
  }

  private disposeObject(object: Group): void {
    object.removeFromParent()
    object.traverse(node => {
      if (!(node instanceof Mesh)) return
      node.geometry.dispose()
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) material.dispose()
    })
  }

  private disposeScene(): void {
    this.knight.object.removeFromParent()
    this.meadow.scene.traverse(node => {
      if (!(node instanceof Mesh)) return
      node.geometry.dispose()
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) material.dispose()
    })
    this.dummies.clear()
    this.meadow.field.texture.dispose()
    this.meadow.env.noise.dispose()
    this.meadow.sun.shadow.dispose()
    this.post.dispose()
    this.meadow.scene.clear()
  }
}
