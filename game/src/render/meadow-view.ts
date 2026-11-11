import { Mesh, NeutralToneMapping, PCFShadowMap, type Group, type WebGPURenderer } from 'three/webgpu'
import { bookmark, type BookmarkName } from '../look/bookmarks'
import { createEnemy, poseEnemy } from './combat/creaseback'
import { TICK_DT, type Entity, type World } from '../sim/core/types'
import { CombatFeedback } from './combat/feedback'
import { CameraRig } from './basic/camera'
import { CharacterView, loadCharacter, type CharacterAsset } from './characters/character'
import { actorPoseState } from './characters/pose'
import { AimIndicator } from './characters/aim'
import { createMeadow } from './meadow'
import { createPost } from './post/pipeline'
import type { Frame, RenderView } from './view'

/** Tick-driven meadow presentation; simulation coordinates start at the meadow's player clearing. */
export class MeadowView implements RenderView {
  readonly camera: CameraRig
  private meadow
  private post
  private knight: CharacterView
  private dummies = new Map<number, Group>()
  private readonly aim = new AimIndicator()
  private currentActor: Entity | undefined
  private previousActor: Entity | undefined
  private world: Readonly<World> | null = null
  private feedback: CombatFeedback
  private renderTime = 0
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
    this.meadow = createMeadow(world.seed, world.arena)
    this.feedback = new CombatFeedback(this.meadow.field)
    this.meadow.scene.add(this.feedback.object)
    this.knight = new CharacterView(asset, { env: this.meadow.env })
    this.meadow.scene.add(this.knight.object, this.aim.object)
    this.post = createPost(renderer, this.meadow.scene, this.camera.camera)
    this.registerBookmarks()
    this.advance(world)
  }

  /** Retain adjacent actor samples; all continuation data belongs to simulation. */
  advance(world: Readonly<World>): void {
    if (world !== this.world || world.tick < this.tick) {
      this.camera.resetFollow()
      this.currentActor = undefined
      this.previousActor = undefined
      this.world = world
    }
    if (world.tick !== this.tick || !this.currentActor) {
      this.previousActor = world.tick === this.tick + 1 ? this.currentActor : undefined
      const actor = world.entities.find(entity => entity.id === world.playerId)
      this.currentActor = actor ? structuredClone(actor) : undefined
    }
    this.tick = world.tick
  }

  groundPoint(x: number, y: number) {
    const point = this.camera.groundPoint(x, y, this.meadow.field.heightAt)
    return point ? { x: point.x - this.meadow.field.player.x, z: point.z - this.meadow.field.player.z } : null
  }

  sync(frame: Frame): void {
    if (frame.world.seed !== this.meadow.field.seed || (this.meadow.field.arena?.radius ?? null) !== (frame.world.arena?.radius ?? null) ||
      Math.abs((this.meadow.field.arena?.center.x ?? 0) - (frame.world.arena ? frame.world.arena.center.x + this.meadow.field.player.x : 0)) > 1e-6 ||
      Math.abs((this.meadow.field.arena?.center.z ?? 0) - (frame.world.arena ? frame.world.arena.center.z + this.meadow.field.player.z : 0)) > 1e-6) {
      this.disposeScene()
      this.meadow = createMeadow(frame.world.seed, frame.world.arena)
      this.feedback = new CombatFeedback(this.meadow.field)
      this.meadow.scene.add(this.feedback.object)
      this.knight.setEnvironment(this.meadow.env)
      this.meadow.scene.add(this.knight.object, this.aim.object)
      this.post = createPost(this.renderer, this.meadow.scene, this.camera.camera)
      this.registerBookmarks()
      this.framing = undefined
    }
    this.advance(frame.world)
    const present = new Set<number>()
    const time = (frame.world.tick + frame.alpha) * TICK_DT
    const dt = Math.max(0, Math.min(0.1, time - this.renderTime))
    this.renderTime = time
    this.feedback.sync(frame)
    this.knight.object.visible = false
    this.aim.object.visible = false
    for (const entity of frame.world.entities) {
      present.add(entity.id)
      const previous = entity.impactPauseTicks > 0 ? { ...entity.pos, facing: entity.facing } : frame.prev.get(entity.id) ?? { ...entity.pos, facing: entity.facing }
      const x = previous.x + (entity.pos.x - previous.x) * frame.alpha + this.meadow.field.player.x
      const z = previous.z + (entity.pos.z - previous.z) * frame.alpha + this.meadow.field.player.z
      const y = this.meadow.field.heightAt(x, z)
      const turn = Math.atan2(Math.sin(entity.facing - previous.facing), Math.cos(entity.facing - previous.facing))
      const facing = previous.facing + turn * frame.alpha
      if (entity.id === frame.world.playerId) {
        this.knight.object.visible = true
        this.knight.object.position.set(x, y, z)
        const characterPose = this.knight.poseActor({ ...actorPoseState(entity, frame.world, this.previousActor),
          actor: { ...entity, facing } }, frame.alpha)
        this.feedback.flash(this.knight.object, entity)
        this.aim.object.visible = entity.death === null
        this.aim.object.position.set(x, y, z)
        this.aim.point(characterPose.aim)
        const pose = bookmark('player', this.meadow.field)
        const ground = this.meadow.field.heightAt(this.meadow.field.player.x, this.meadow.field.player.z)
        this.camera.register('meadow-player', {
          position: { x: x + pose.position[0] - this.meadow.field.player.x, y: pose.position[1] + y - ground,
            z: z + pose.position[2] - this.meadow.field.player.z },
          target: { x, y: y + 0.9, z }, fov: pose.fov
        })
        if (this.camera.activeBookmark === 'meadow-player') this.camera.bookmark('meadow-player')
        this.camera.update({ x, y, z }, dt)
        this.meadow.setPlayer(x, z)
        if (this.camera.isFollowing || this.camera.activeBookmark === 'meadow-player') this.meadow.setFocus(x, z - 2, 28)
      } else {
        let dummy = this.dummies.get(entity.id)
        if (!dummy) {
          dummy = createEnemy(this.meadow.env)
          this.dummies.set(entity.id, dummy)
          this.meadow.scene.add(dummy)
        }
        dummy.position.set(x, y, z)
        dummy.rotation.y = Math.PI / 2 - facing
        const skill = frame.world.content.skills.find(skill => skill.id === entity.action?.id)
        poseEnemy(dummy, entity, skill?.timing.windupTicks ?? 24)
        this.feedback.flash(dummy, entity)
      }
    }
    for (const [id, dummy] of this.dummies) {
      if (!present.has(id)) { this.disposeObject(dummy); this.dummies.delete(id) }
    }
    const name = this.camera.activeBookmark
    if (name !== this.framing) {
      if (name?.startsWith('meadow-') && name !== 'meadow-player') {
        const pose = bookmark(name.slice(7) as BookmarkName, this.meadow.field)
        this.meadow.setFocus(...pose.focus, pose.shadowExtent)
      }
      this.framing = name
    }
    this.feedback.layout(this.camera.camera)
    this.meadow.update(time, this.camera.camera)
  }

  render(): void { this.post.render() }

  resize(width: number, height: number, pixelRatio: number): void {
    this.renderer.setPixelRatio(pixelRatio)
    this.renderer.setSize(width, height, false)
    this.camera.camera.aspect = width / height
    this.camera.camera.updateProjectionMatrix()
  }

  dispose(): void { this.disposeScene(); this.knight.dispose(); this.aim.dispose(); this.camera.dispose() }

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
    this.feedback.dispose()
    this.knight.object.removeFromParent()
    this.aim.object.removeFromParent()
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
