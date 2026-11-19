import { CylinderGeometry, Group, Mesh, MeshBasicNodeMaterial, OctahedronGeometry, RingGeometry } from 'three/webgpu'
import type { GroundDrop } from '../sim/core/types'

/** Gold survey marks identify collectible items in either view. */
export class GroundDropMarkers {
  readonly object = new Group()
  private readonly markers = new Map<number, Group>()
  private readonly diamond = new OctahedronGeometry(0.22)
  private readonly stem = new CylinderGeometry(0.016, 0.027, 0.74, 4)
  private readonly ring = new RingGeometry(0.26, 0.31, 4)
  private readonly gold = new MeshBasicNodeMaterial({ color: 0xffdf8c })
  private readonly bronze = new MeshBasicNodeMaterial({ color: 0xc29354 })

  sync(drops: readonly GroundDrop[], heightAt: (x: number, z: number) => number, origin = { x: 0, z: 0 }): void {
    if (drops.length === 0 && this.markers.size === 0) return
    const present = new Set<number>()
    for (const { item, pos } of drops) {
      present.add(item.id)
      let mark = this.markers.get(item.id)
      if (!mark) {
        mark = new Group()
        const diamond = new Mesh(this.diamond, this.gold)
        diamond.position.y = 0.92
        diamond.scale.y = 1.45
        const stem = new Mesh(this.stem, this.bronze)
        stem.position.y = 0.4
        const ring = new Mesh(this.ring, this.gold)
        ring.rotation.x = -Math.PI / 2
        ring.position.y = 0.065
        mark.add(ring, stem, diamond)
        this.markers.set(item.id, mark)
        this.object.add(mark)
      }
      const x = origin.x + pos.x, z = origin.z + pos.z
      mark.position.set(x, heightAt(x, z), z)
    }
    for (const [id, mark] of this.markers) {
      if (!present.has(id)) { mark.removeFromParent(); this.markers.delete(id) }
    }
  }

  dispose(): void {
    this.object.removeFromParent()
    this.object.clear()
    this.markers.clear()
    this.diamond.dispose(); this.stem.dispose(); this.ring.dispose()
    this.gold.dispose(); this.bronze.dispose()
  }
}
