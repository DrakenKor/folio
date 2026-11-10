import { PerspectiveCamera, Plane, Raycaster, Vector2, Vector3 } from 'three/webgpu'
import type { Vec2 } from '../../sim/core/index'

export interface CameraPose {
  position: { x: number; y: number; z: number }
  target: { x: number; y: number; z: number }
}

/** Three-quarter follow camera with deterministic screenshot bookmarks. */
export class CameraRig {
  readonly camera = new PerspectiveCamera(45, 1, 0.1, 500)
  private following = true
  private player: Vec2 = { x: 0, z: 0 }
  private target = new Vector3()
  private ray = new Raycaster()
  private ground = new Plane(new Vector3(0, 1, 0), 0)
  private bookmarks = new Map<string, CameraPose>([
    ['overview', { position: { x: 10, y: 38, z: 26 }, target: { x: 8, y: 0, z: 0 } }],
    ['player', { position: { x: 0, y: 14, z: 10 }, target: { x: 0, y: 0, z: 0 } }]
  ])

  constructor(private canvas: HTMLCanvasElement) { this.update({ x: 0, z: 0 }) }

  register(name: string, pose: CameraPose): void { this.bookmarks.set(name, structuredClone(pose)) }

  bookmark(name: string): void {
    const pose = this.bookmarks.get(name)
    if (!pose) throw new RangeError(`Unknown camera bookmark: ${name}`)
    const offset = name === 'player' ? this.player : { x: 0, z: 0 }
    this.set({ position: { x: pose.position.x + offset.x, y: pose.position.y, z: pose.position.z + offset.z },
      target: { x: pose.target.x + offset.x, y: pose.target.y, z: pose.target.z + offset.z } })
  }

  set(pose: CameraPose): void {
    if (![pose?.position?.x, pose?.position?.y, pose?.position?.z,
      pose?.target?.x, pose?.target?.y, pose?.target?.z].every(Number.isFinite)) throw new TypeError('Invalid camera pose')
    this.following = false
    this.camera.position.set(pose.position.x, pose.position.y, pose.position.z)
    this.target.set(pose.target.x, pose.target.y, pose.target.z)
    this.look()
  }

  follow(): void { this.following = true }

  update(player: Vec2): void {
    this.player = { ...player }
    if (!this.following) return
    this.target.set(player.x, 0, player.z)
    this.camera.position.set(player.x, 20, player.z + 14)
    this.look()
  }

  basis() {
    const direction = this.camera.getWorldDirection(new Vector3())
    const length = Math.hypot(direction.x, direction.z)
    const forward = length > 1e-6 ? { x: direction.x / length, z: direction.z / length } : { x: 0, z: -1 }
    return { forward, right: { x: -forward.z, z: forward.x } }
  }

  groundPoint(x: number, y: number): Vec2 | null {
    const rect = this.canvas.getBoundingClientRect()
    this.ray.setFromCamera(new Vector2((x - rect.left) / rect.width * 2 - 1,
      1 - (y - rect.top) / rect.height * 2), this.camera)
    const hit = this.ray.ray.intersectPlane(this.ground, new Vector3())
    return hit ? { x: hit.x, z: hit.z } : null
  }

  private look(): void { this.camera.lookAt(this.target); this.camera.updateMatrixWorld() }
}
