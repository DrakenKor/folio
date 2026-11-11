// Broad stone faces meet a worn top and narrow, softly lit chamfers.
import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three/webgpu'

export function stoneGeometry(random: () => number): BufferGeometry {
  const count = 5 + Math.floor(random() * 3)
  const corners = Array.from({ length: count }, (_, i) => {
    const angle = (i + (random() - 0.5) * 0.35) / count * Math.PI * 2
    const radius = 0.78 + random() * 0.34
    return new Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius)
  })
  const tilt = new Vector3((random() - 0.5) * 0.32, 0, (random() - 0.5) * 0.32)
  const topScale = corners.map(() => 0.46 + random() * 0.25)
  const rings = [[0.86, -0.22], [1.02, -0.03], [1, 0.20], [0.84, 0.28], [0.88, 0.58], [0.60, 0.81]].map(([scale, y], ring) =>
    corners.map((p, i) => {
      const s = ring === 5 ? topScale[i]! : scale!
      const wear = ring > 1 ? Math.sin(i * 2.3) * 0.055 : 0
      return new Vector3(p.x * s + Math.max(0, ring - 1) * 0.06, y! + p.dot(tilt) + wear, p.z * s - ring * 0.025)
    }))
  const positions: number[] = []
  const polygon = (points: Vector3[]) => {
    for (let i = 1; i < points.length - 1; i++) {
      for (const p of [points[0]!, points[i]!, points[i + 1]!]) {
        positions.push(p.x, p.y, p.z)
      }
    }
  }
  for (let r = 0; r < rings.length - 1; r++) {
    for (let i = 0; i < count; i++) {
      const j = (i + 1) % count
      polygon([rings[r]![i]!, rings[r + 1]![i]!, rings[r + 1]![j]!, rings[r]![j]!])
    }
  }
  polygon([...rings[rings.length - 1]!].reverse())
  polygon(rings[0]!)
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  smoothStoneNormals(geometry)
  return geometry
}

/** Shares angle-weighted normals across bevels while retaining the stone's broad geometric planes. */
export function smoothStoneNormals(geometry: BufferGeometry): void {
  const positions = geometry.getAttribute('position')
  const sums = new Map<string, Vector3>()
  const keys = Array.from({ length: positions.count }, (_, i) =>
    `${positions.getX(i).toFixed(5)},${positions.getY(i).toFixed(5)},${positions.getZ(i).toFixed(5)}`)
  const index = geometry.index
  const count = index?.count ?? positions.count
  for (let i = 0; i < count; i += 3) {
    const ids = [0, 1, 2].map(j => index ? index.getX(i + j) : i + j)
    const points = ids.map(j => new Vector3().fromBufferAttribute(positions, j))
    const normal = points[1]!.clone().sub(points[0]!).cross(points[2]!.clone().sub(points[0]!)).normalize()
    ids.forEach((id, corner) => {
      const a = points[(corner + 1) % 3]!.clone().sub(points[corner]!).normalize()
      const b = points[(corner + 2) % 3]!.clone().sub(points[corner]!).normalize()
      const angle = Math.acos(Math.max(-1, Math.min(1, a.dot(b))))
      const key = keys[id]!
      const sum = sums.get(key) ?? new Vector3()
      sums.set(key, sum.addScaledVector(normal, angle))
    })
  }
  const normals = keys.flatMap(key => sums.get(key)!.clone().normalize().toArray())
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3))
}
