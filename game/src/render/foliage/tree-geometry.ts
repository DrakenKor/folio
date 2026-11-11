import { BufferGeometry, Float32BufferAttribute, LatheGeometry, Vector2, Vector3 } from 'three/webgpu'

/** Lobed leaf masses give rounded, oval and umbrella crowns distinct outlines. */
export function crownGeometry(phase: number, form: 'rounded' | 'oval' | 'umbrella'): LatheGeometry {
  const profile = form === 'umbrella'
    ? [[0.001, -0.35], [0.58, -0.30], [0.92, -0.08], [1, 0.14], [0.81, 0.42], [0.46, 0.65], [0.001, 0.73]]
    : [[0.001, -0.72], [0.62, -0.53], [0.94, -0.15], [1, 0.22], [0.83, 0.66], [0.46, 0.96], [0.001, 1.1]]
  const segments = 36
  const geometry = new LatheGeometry(profile.map(([r, y]) => new Vector2(r, y)), segments)
  const position = geometry.getAttribute('position')
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i)
    const y = position.getY(i)
    const z = position.getZ(i)
    const a = Math.atan2(x, z)
    const r = Math.hypot(x, z)
    const lobes = 1 + Math.sin(a * 3 + phase + y) * 0.19
      + Math.cos(a * 7 - phase + y * 2) * 0.12 + Math.sin(a * 11 + phase) * 0.045
    position.setXYZ(i, x * lobes + y * 0.24,
      y + r * (Math.sin(a * 3 + phase) * 0.16 + Math.cos(a * 5 - phase) * 0.08),
      z * lobes)
  }
  geometry.computeVertexNormals()
  const normals = geometry.getAttribute('normal')
  for (let i = 0; i < position.count; i++) {
    const broad = new Vector3(position.getX(i) * 0.7, (position.getY(i) - 0.14) * (form === 'umbrella' ? 2 : 0.8), position.getZ(i) * 0.7).normalize()
    const n = new Vector3().fromBufferAttribute(normals, i).lerp(broad, 0.6).normalize()
    normals.setXYZ(i, n.x, n.y, n.z)
  }
  for (let j = 0; j < profile.length; j++) {
    const last = segments * profile.length + j
    const n = new Vector3().fromBufferAttribute(normals, j)
      .add(new Vector3().fromBufferAttribute(normals, last)).normalize()
    normals.setXYZ(j, n.x, n.y, n.z)
    normals.setXYZ(last, n.x, n.y, n.z)
  }
  return geometry
}

/** A needle spray grows outward along +x, arching then drooping to a ragged tip. */
export function pineBoughGeometry(phase: number): BufferGeometry {
  const widths = [0.025, 0.18, 0.29, 0.25, 0.32, 0.23, 0.26, 0.16, 0.18, 0.07, 0.001]
  const sides = 12
  const positions: number[] = []
  const indices: number[] = []
  widths.forEach((width, row) => {
    const t = row / (widths.length - 1)
    const arch = Math.sin(t * Math.PI) * 0.20 - t * t * 0.24
    for (let side = 0; side < sides; side++) {
      const a = side / sides * Math.PI * 2
      const edge = 1 + Math.sin(row * 2.7 + phase + side * 1.3) * 0.16
      positions.push(t, arch + Math.cos(a) * width * 0.58 * edge, Math.sin(a) * width * edge)
      if (row === 0) continue
      const p = (row - 1) * sides + side
      const q = (row - 1) * sides + (side + 1) % sides
      indices.push(p, q, p + sides, q, q + sides, p + sides)
    }
  })
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}
