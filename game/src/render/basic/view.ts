import { BoxGeometry, CapsuleGeometry, Color, DirectionalLight, GridHelper, Group,
  HemisphereLight, Mesh, MeshStandardNodeMaterial, PlaneGeometry, Scene } from 'three/webgpu'
import type { WebGPURenderer } from 'three/webgpu'
import type { Frame, RenderView } from '../view'
import { CameraRig } from './camera'

/** Replaceable ground grid and capsule view; never mutates the simulation. */
export class BasicView implements RenderView {
  readonly camera: CameraRig
  private scene = new Scene()
  private entities = new Map<number, Group>()
  private capsule = new CapsuleGeometry(0.4, 0.8, 4, 8)
  private tick = new BoxGeometry(0.65, 0.07, 0.07)
  private playerMaterial = new MeshStandardNodeMaterial({ color: 0xffcb68 })
  private dummyMaterial = new MeshStandardNodeMaterial({ color: 0x6da9d8 })
  private facingMaterial = new MeshStandardNodeMaterial({ color: 0x243044 })
  private groundGeometry = new PlaneGeometry(240, 240)
  private groundMaterial = new MeshStandardNodeMaterial({ color: 0x334c46 })
  private grid = new GridHelper(240, 120, 0x89a798, 0x4b675d)

  constructor(private renderer: WebGPURenderer) {
    this.camera = new CameraRig(renderer.domElement)
    this.scene.background = new Color(0xacc8d7)
    this.scene.add(new HemisphereLight(0xdcefff, 0x48523a, 2))
    const sun = new DirectionalLight(0xffe2b5, 2.5)
    sun.position.set(20, 40, 15)
    this.scene.add(sun)
    const ground = new Mesh(this.groundGeometry, this.groundMaterial)
    ground.rotation.x = -Math.PI / 2
    this.grid.position.y = 0.01
    this.scene.add(ground, this.grid)
  }

  sync(frame: Frame): void {
    const present = new Set<number>()
    for (const entity of frame.world.entities) {
      present.add(entity.id)
      let group = this.entities.get(entity.id)
      if (!group) {
        group = new Group()
        const body = new Mesh(this.capsule, entity.kind === 'player' ? this.playerMaterial : this.dummyMaterial)
        body.position.y = 0.8
        const facing = new Mesh(this.tick, this.facingMaterial)
        facing.position.set(0.48, 1.1, 0)
        group.add(body, facing)
        this.entities.set(entity.id, group)
        this.scene.add(group)
      }
      const prev = frame.prev.get(entity.id) ?? { ...entity.pos, facing: entity.facing }
      const x = prev.x + (entity.pos.x - prev.x) * frame.alpha
      const z = prev.z + (entity.pos.z - prev.z) * frame.alpha
      const turn = Math.atan2(Math.sin(entity.facing - prev.facing), Math.cos(entity.facing - prev.facing))
      group.position.set(x, 0, z)
      group.rotation.y = -(prev.facing + turn * frame.alpha)
      group.scale.setScalar(entity.radius / 0.4)
      if (entity.id === frame.world.playerId) this.camera.update({ x, z })
    }
    for (const [id, group] of this.entities) {
      if (!present.has(id)) { this.scene.remove(group); this.entities.delete(id) }
    }
  }

  render(): void { this.renderer.render(this.scene, this.camera.camera) }

  resize(width: number, height: number, pixelRatio: number): void {
    this.renderer.setPixelRatio(pixelRatio)
    this.renderer.setSize(width, height, false)
    this.camera.camera.aspect = width / height
    this.camera.camera.updateProjectionMatrix()
  }

  dispose(): void {
    this.capsule.dispose(); this.tick.dispose(); this.groundGeometry.dispose()
    this.playerMaterial.dispose(); this.dummyMaterial.dispose(); this.facingMaterial.dispose(); this.groundMaterial.dispose()
    this.grid.dispose()
    this.scene.clear()
    this.entities.clear()
  }
}
