import { ConeGeometry, Group, Mesh, MeshBasicNodeMaterial } from 'three/webgpu'

/** Ground chevron follows aim independently of the body's movement-facing rig. */
export class AimIndicator {
  readonly object = new Group()
  private readonly geometry = new ConeGeometry(0.085, 0.25, 3)
  private readonly material = new MeshBasicNodeMaterial({ color: 0xd6ae65 })

  constructor() {
    const arrow = new Mesh(this.geometry, this.material)
    arrow.rotation.x = Math.PI / 2
    arrow.position.set(0, 0.04, 0.8)
    this.object.add(arrow)
  }

  point(angle: number): void { this.object.rotation.y = Math.PI / 2 - angle }

  dispose(): void {
    this.object.removeFromParent()
    this.geometry.dispose()
    this.material.dispose()
  }
}
