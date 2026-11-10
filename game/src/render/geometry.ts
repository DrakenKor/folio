// Merges many small procedural parts into one geometry with per-vertex extras,
// so a whole forest or rock field is one draw call.
import { BufferAttribute, BufferGeometry, type Matrix4, Matrix3, Vector3 } from 'three/webgpu'

export interface PartExtras {
  color: [number, number, number]
  /** Per-vertex attributes keyed by name, computed from the transformed vertex. */
  vertex?: (position: Vector3, normal: Vector3, index: number) => Record<string, number[]>
}

export class GeometryBuilder {
  private readonly positions: number[] = []
  private readonly normals: number[] = []
  private readonly colors: number[] = []
  private readonly indices: number[] = []
  private readonly extras = new Map<string, { size: number; data: number[] }>()

  /** Appends `part` transformed by `matrix`. Indexed and non-indexed parts both work. */
  add(part: BufferGeometry, matrix: Matrix4, extras: PartExtras): void {
    const pos = part.attributes.position!
    const nor = part.attributes.normal!
    const normalMatrix = new Matrix3().getNormalMatrix(matrix)
    const base = this.positions.length / 3
    const p = new Vector3()
    const n = new Vector3()
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i).applyMatrix4(matrix)
      n.fromBufferAttribute(nor, i).applyMatrix3(normalMatrix).normalize()
      this.positions.push(p.x, p.y, p.z)
      this.normals.push(n.x, n.y, n.z)
      this.colors.push(...extras.color)
      if (extras.vertex) {
        for (const [name, values] of Object.entries(extras.vertex(p, n, i))) {
          let entry = this.extras.get(name)
          if (!entry) {
            entry = { size: values.length, data: [] }
            this.extras.set(name, entry)
          }
          entry.data.push(...values)
        }
      }
    }
    const index = part.index
    if (index) {
      for (let i = 0; i < index.count; i++) this.indices.push(base + index.getX(i))
    } else {
      for (let i = 0; i < pos.count; i++) this.indices.push(base + i)
    }
  }

  build(): BufferGeometry {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(this.positions), 3))
    geometry.setAttribute('normal', new BufferAttribute(new Float32Array(this.normals), 3))
    geometry.setAttribute('color', new BufferAttribute(new Float32Array(this.colors), 3))
    for (const [name, { size, data }] of this.extras) {
      geometry.setAttribute(name, new BufferAttribute(new Float32Array(data), size))
    }
    const vertexCount = this.positions.length / 3
    geometry.setIndex(vertexCount > 65535 ? new BufferAttribute(new Uint32Array(this.indices), 1) : this.indices)
    geometry.computeBoundingSphere()
    return geometry
  }
}

/** Linear sRGB triple from a hex string, for vertex colours. */
export function linearColor(hex: string, scale = 1): [number, number, number] {
  const v = parseInt(hex.slice(1), 16)
  const toLinear = (c: number) => {
    const s = c / 255
    return (s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)) * scale
  }
  return [toLinear((v >> 16) & 255), toLinear((v >> 8) & 255), toLinear(v & 255)]
}
