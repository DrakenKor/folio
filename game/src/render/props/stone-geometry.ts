// An irregular boulder: a jittered faceted sphere sliced by a few planes, so
// broad flat faces (a tilted top, a buried base, two sides) meet rows of small
// chamfer facets that catch the light.
import { BufferGeometry, Float32BufferAttribute, IcosahedronGeometry, Vector3 } from 'three/webgpu'

interface Cut { normal: Vector3; offset: number }

export function stoneGeometry(random: () => number): BufferGeometry {
  const side = () => {
    const a = random() * Math.PI * 2
    return { normal: new Vector3(Math.cos(a), (random() - 0.3) * 0.5, Math.sin(a)).normalize(), offset: 0.7 + random() * 0.14 }
  }
  const cuts: Cut[] = [
    { normal: new Vector3((random() - 0.5) * 0.6, 1, (random() - 0.5) * 0.6).normalize(), offset: 0.62 + random() * 0.12 },
    { normal: new Vector3(0, -1, 0), offset: 0.62 },
    side(),
    side()
  ]
  // One displaced position per shared corner, so facets stay closed.
  const corners = new Map<string, Vector3>()
  const shape = (p: Vector3) => {
    const key = `${p.x.toFixed(4)},${p.y.toFixed(4)},${p.z.toFixed(4)}`
    let q = corners.get(key)
    if (!q) {
      q = p.clone().multiplyScalar(0.86 + random() * 0.26)
      for (const { normal, offset } of cuts) {
        const over = q.dot(normal) - offset
        if (over > 0) q.addScaledVector(normal, -over)
      }
      corners.set(key, q)
    }
    return q
  }

  const sphere = new IcosahedronGeometry(1, 1)
  const source = sphere.attributes.position!
  const positions: number[] = []
  const normals: number[] = []
  const p = new Vector3()
  for (let i = 0; i < source.count; i += 3) {
    const tri = [0, 1, 2].map(k => shape(p.fromBufferAttribute(source, i + k)))
    const normal = tri[1]!.clone().sub(tri[0]!).cross(tri[2]!.clone().sub(tri[0]!))
    // Cuts can collapse a facet to a sliver; drop those.
    if (normal.lengthSq() < 1e-8) continue
    normal.normalize()
    for (const q of tri) {
      positions.push(q.x, q.y, q.z)
      normals.push(normal.x, normal.y, normal.z)
    }
  }
  sphere.dispose()
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3))
  return geometry
}
