import { PerspectiveCamera, Plane, Raycaster, Vector2, Vector3 } from 'three/webgpu'
import type { Vec2 } from '../../sim/core/index'

export interface CameraPose {
  position: { x: number; y: number; z: number }
  target: { x: number; y: number; z: number }
  fov?: number
}

/** Three-quarter follow camera with deterministic screenshot bookmarks. */
export class CameraRig {
  readonly camera = new PerspectiveCamera(45, 1, 0.1, 500)
  private following = true
  activeBookmark: string | null = null
  private player: Vec2 = { x: 0, z: 0 }
  private target = new Vector3()
  private ray = new Raycaster()
  private ground = new Plane(new Vector3(0, 1, 0), 0)
  private bookmarks = new Map<string, CameraPose>([
    ['overview', { position: { x: 10, y: 38, z: 26 }, target: { x: 8, y: 0, z: 0 } }],
    ['player', { position: { x: 0, y: 14, z: 10 }, target: { x: 0, y: 0, z: 0 } }]
  ])
  private distance = 17
  private yaw = 20
  private snap = true
  private readonly controls = new AbortController()

  constructor(private canvas: HTMLCanvasElement, private followPose: CameraPose = {
    position: { x: 0, y: 20, z: 14 }, target: { x: 0, y: 0, z: 0 }
  }) {
    this.update({ x: 0, z: 0 })
    canvas.addEventListener('wheel', event => {
      event.preventDefault()
      this.setOrbit(this.distance + (event.shiftKey ? 0 : event.deltaY * 0.012),
        this.yaw + (event.shiftKey ? event.deltaY * 0.08 : 0))
    }, { passive: false, signal: this.controls.signal })
  }

  get isFollowing(): boolean { return this.following }

  register(name: string, pose: CameraPose): void { this.bookmarks.set(name, structuredClone(pose)) }

  bookmark(name: string): void {
    const pose = this.bookmarks.get(name)
    if (!pose) throw new RangeError(`Unknown camera bookmark: ${name}`)
    const offset = name === 'player' ? this.player : { x: 0, z: 0 }
    this.set({ position: { x: pose.position.x + offset.x, y: pose.position.y, z: pose.position.z + offset.z },
      target: { x: pose.target.x + offset.x, y: pose.target.y, z: pose.target.z + offset.z }, fov: pose.fov })
    this.activeBookmark = name
  }

  set(pose: CameraPose): void {
    if (![pose?.position?.x, pose?.position?.y, pose?.position?.z,
      pose?.target?.x, pose?.target?.y, pose?.target?.z].every(Number.isFinite)) throw new TypeError('Invalid camera pose')
    this.following = false
    this.activeBookmark = null
    this.camera.position.set(pose.position.x, pose.position.y, pose.position.z)
    this.target.set(pose.target.x, pose.target.y, pose.target.z)
    if (pose.fov !== undefined) { this.camera.fov = pose.fov; this.camera.updateProjectionMatrix() }
    this.look()
  }

  follow(): void { this.following = true; this.activeBookmark = null; this.snap = true }

  /** Bounded distance and yaw preserve the 55° gameplay pitch. */
  setOrbit(distance: number, yaw: number): void {
    if (!Number.isFinite(distance) || !Number.isFinite(yaw)) return
    this.distance = Math.max(17, Math.min(22, distance))
    this.yaw = Math.max(-5, Math.min(35, yaw))
    const pitch = 55 * Math.PI / 180
    const angle = this.yaw * Math.PI / 180
    this.followPose.position = { x: Math.sin(angle) * Math.cos(pitch) * this.distance,
      y: 0.9 + Math.sin(pitch) * this.distance, z: Math.cos(angle) * Math.cos(pitch) * this.distance }
    this.follow()
  }

  resetFollow(): void { this.snap = true }

  dispose(): void { this.controls.abort() }

  update(player: Vec2 & { y?: number }, dt = 1 / 60): void {
    this.player = { ...player }
    this.ground.constant = -(player.y ?? 0)
    if (!this.following) return
    const { position, target, fov } = this.followPose
    const height = player.y ?? 0
    const blend = this.snap ? 1 : 1 - Math.exp(-14 * Math.max(0, dt))
    this.target.lerp(new Vector3(player.x + target.x, height + target.y, player.z + target.z), blend)
    this.camera.position.lerp(new Vector3(player.x + position.x, height + position.y, player.z + position.z), blend)
    this.snap = false
    if (fov !== undefined && this.camera.fov !== fov) { this.camera.fov = fov; this.camera.updateProjectionMatrix() }
    this.look()
  }

  basis() {
    const direction = this.camera.getWorldDirection(new Vector3())
    const length = Math.hypot(direction.x, direction.z)
    const forward = length > 1e-6 ? { x: direction.x / length, z: direction.z / length } : { x: 0, z: -1 }
    return { forward, right: { x: -forward.z, z: forward.x } }
  }

  groundPoint(x: number, y: number, heightAt?: (x: number, z: number) => number): Vec2 | null {
    const rect = this.canvas.getBoundingClientRect()
    this.ray.setFromCamera(new Vector2((x - rect.left) / rect.width * 2 - 1,
      1 - (y - rect.top) / rect.height * 2), this.camera)
    const plane = this.ground.clone()
    const hit = this.ray.ray.intersectPlane(plane, new Vector3())
    if (hit && heightAt) for (let i = 0; i < 8; i++) {
      plane.constant = -heightAt(hit.x, hit.z)
      if (!this.ray.ray.intersectPlane(plane, hit)) return null
    }
    return hit ? { x: hit.x, z: hit.z } : null
  }

  private look(): void { this.camera.lookAt(this.target); this.camera.updateMatrixWorld() }
}
