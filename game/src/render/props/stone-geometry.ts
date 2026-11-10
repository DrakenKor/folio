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
  const topScale = corners.map(() => 0.57 + random() * 0.22)
  const rings = [[0.80, -0.22], [1, -0.03], [0.94, 0.48], [0.70, 0.77]].map(([scale, y], ring) =>
    corners.map((p, i) => {
      const s = ring === 3 ? topScale[i]! : scale!
      const wear = ring === 2 ? Math.sin(i * 2.3) * 0.075 : 0
      return new Vector3(p.x * s + (ring > 1 ? 0.08 : 0), y! + p.dot(tilt) + wear, p.z * s)
    }))
  const positions: number[] = []
  const normals: number[] = []
  const polygon = (points: Vector3[]) => {
    const face = points[1]!.clone().sub(points[0]!).cross(points[2]!.clone().sub(points[0]!)).normalize()
    for (let i = 1; i < points.length - 1; i++) {
      for (const p of [points[0]!, points[i]!, points[i + 1]!]) {
        const rounded = new Vector3(p.x, p.y * 0.6, p.z).normalize()
        const n = face.clone().lerp(rounded, 0.24).normalize()
        positions.push(p.x, p.y, p.z)
        normals.push(n.x, n.y, n.z)
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
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3))
  return geometry
}
