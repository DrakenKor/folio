import { BufferAttribute, Color, Mesh, type BufferGeometry, type Material, type Object3D, type Texture } from 'three/webgpu'
import { attribute } from 'three/tsl'
import { CelMaterial, isCelMaterial } from '../materials/cel'
import type { Environment } from '../materials/environment'

/** Averages normals across vertices that share a position, so the hull does not split at hard edges. */
function smoothNormals(geometry: BufferGeometry): BufferAttribute {
  const position = geometry.getAttribute('position')
  const normal = geometry.getAttribute('normal')
  const sums = new Map<string, [number, number, number]>()
  const keys: string[] = []
  for (let i = 0; i < position.count; i++) {
    const key = `${position.getX(i).toFixed(4)},${position.getY(i).toFixed(4)},${position.getZ(i).toFixed(4)}`
    keys.push(key)
    const sum = sums.get(key) ?? [0, 0, 0]
    sum[0] += normal.getX(i)
    sum[1] += normal.getY(i)
    sum[2] += normal.getZ(i)
    sums.set(key, sum)
  }
  const out = new Float32Array(position.count * 3)
  keys.forEach((key, i) => {
    const [x, y, z] = sums.get(key)!
    const length = Math.hypot(x, y, z) || 1
    out.set([x / length, y / length, z / length], i * 3)
  })
  return new BufferAttribute(out, 3)
}

/** Applies the shared bands, warm rim and pose-following ink to textured characters. */
export function applyToon(root: Object3D, env: Environment): void {
  root.traverse(node => {
    if (!(node instanceof Mesh)) return
    if (!node.geometry.hasAttribute('inkNormal')) {
      node.geometry = node.geometry.clone()
      node.geometry.setAttribute('inkNormal', smoothNormals(node.geometry))
    }
    const convert = (source: Material & { map?: Texture | null; color?: Color }) => {
      const material = new CelMaterial(env, {
        map: source.map ?? null,
        color: source.color ?? new Color(0xffffff),
        side: source.side,
        readability: true,
        outlineNormal: attribute('inkNormal', 'vec3')
      })
      material.name = source.name
      if (isCelMaterial(source)) source.dispose()
      return material
    }
    node.material = Array.isArray(node.material) ? node.material.map(convert) : convert(node.material)
    node.castShadow = node.receiveShadow = true
  })
}
