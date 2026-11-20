import { BoxGeometry, CylinderGeometry, Group, Mesh, MeshStandardNodeMaterial, TorusGeometry, type Object3D } from 'three/webgpu'
import type { WeaponFamily } from '../../sim/core/types'

/** Tool heads mount on the existing right-hand slot, beside the original shield. */
export class ToolHeads {
  readonly heads = new Map<WeaponFamily, Group>()
  private readonly iron = new MeshStandardNodeMaterial({ color: 0x6f7782, roughness: .8 })
  private readonly bronze = new MeshStandardNodeMaterial({ color: 0xc78d50, roughness: .68 })
  private readonly leather = new MeshStandardNodeMaterial({ color: 0x603e39, roughness: .9 })

  constructor(private sword: Object3D) {
    const attach = (family: WeaponFamily) => {
      const head = new Group()
      head.name = family
      this.heads.set(family, head)
      sword.parent?.add(head)
      this.box(head, [.105, .46, .105], [0, .08, -.14], this.leather)
      return head
    }
    const shoe = attach('plumbshoe')
    this.box(shoe, [.18, .48, .16], [0, .44, -.14], this.iron)
    this.box(shoe, [.48, .20, .38], [0, .67, -.16], this.iron)
    this.box(shoe, [.48, .05, .38], [0, .76, -.16], this.bronze)

    const reel = attach('verge-reel')
    const spool = new Mesh(new CylinderGeometry(.215, .215, .17, 12), this.iron)
    spool.rotation.x = Math.PI / 2
    spool.position.set(0, .39, -.14)
    reel.add(spool)
    for (const offset of [-.105, .105]) {
      const rim = new Mesh(new TorusGeometry(.218, .045, 6, 12), this.bronze)
      rim.position.set(0, .39, -.14 + offset)
      reel.add(rim)
    }

    const frame = attach('hearth-frame')
    for (const side of [-1, 1]) {
      this.box(frame, [.51, .085, .11], [0, .53 + side * .19, -.14], this.bronze)
      this.box(frame, [.09, .38, .11], [side * .21, .53, -.14], this.iron)
    }
    this.show()
  }

  show(family?: WeaponFamily): void {
    this.sword.visible = !family || family === 'hemblade'
    for (const [id, head] of this.heads) head.visible = id === family
  }

  private box(group: Group, size: [number, number, number], at: [number, number, number], material: MeshStandardNodeMaterial) {
    const mesh = new Mesh(new BoxGeometry(...size), material)
    mesh.position.set(...at)
    group.add(mesh)
  }
}
