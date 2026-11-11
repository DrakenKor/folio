import { LatheGeometry, Vector2, Vector3 } from 'three/webgpu'

/** Lobed crowns and swept, scalloped evergreen boughs with broad lighting planes. */
export function crownGeometry(evergreen: boolean, phase: number): LatheGeometry {
  const profile = evergreen
    ? [[0.001, -0.06], [0.58, -0.04], [1, 0.05], [0.88, 0.22], [0.53, 0.48], [0.24, 0.78], [0.001, 1]]
    : [[0.001, -0.72], [0.50, -0.65], [0.82, -0.38], [0.99, -0.04], [0.94, 0.30], [0.74, 0.60], [0.40, 0.82], [0.001, 0.90]]
  const segments = 24
  const geometry = new LatheGeometry(profile.map(([r, y]) => new Vector2(r, y)), segments)
  const position = geometry.getAttribute('position')
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i)
    const y = position.getY(i)
    const z = position.getZ(i)
    const angle = Math.atan2(x, z)
    const radius = Math.hypot(x, z)
    const lobes = evergreen
      ? Math.cos(angle * 3 + phase) * 0.12 + Math.sin(angle * 2 + phase) * 0.06
      : Math.sin(angle * 3 + phase + y * 0.8) * 0.12 + Math.cos(angle * 5 - phase) * 0.055
    const sweep = evergreen ? y * y * 0.18 : y * y * 0.14
    position.setXYZ(i, x * (1 + lobes) + sweep,
      y + Math.sin(angle * 3 + phase) * radius * (evergreen ? 0.045 : 0.09),
      z * (1 + lobes))
  }
  geometry.computeVertexNormals()
  const normals = geometry.getAttribute('normal')
  for (let j = 0; j < profile.length; j++) {
    const last = segments * profile.length + j
    const n = new Vector3().fromBufferAttribute(normals, j)
      .add(new Vector3().fromBufferAttribute(normals, last)).normalize()
    normals.setXYZ(j, n.x, n.y, n.z)
    normals.setXYZ(last, n.x, n.y, n.z)
  }
  return geometry
}
