// Broad stone faces meet a bevelled shoulder and a tilted top plane.
import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three/webgpu'

export function stoneGeometry(random: () => number): BufferGeometry {
  const count = random() < 0.5 ? 5 : 6
  const corners = Array.from({ length: count }, (_, i) => {
    const angle = (i + (random() - 0.5) * 0.3) / count * Math.PI * 2
    const radius = 0.78 + random() * 0.36
    return new Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius)
  })
  const tiltX = (random() - 0.5) * 0.36
  const tiltZ = (random() - 0.5) * 0.36
  const topRadius = 0.52 + random() * 0.16
  const topX = (random() - 0.5) * 0.3
  const topZ = (random() - 0.5) * 0.3
  const profiles: Array<[number, number]> = [[0.8, -0.7], [1, -0.32], [0.96, 0.3], [topRadius, 0.82]]
  const rings = profiles.map(([radius, height], ring) =>
    corners.map(p => new Vector3(
      p.x * radius + (ring === 3 ? topX : 0),
      height + p.x * tiltX + p.z * tiltZ,
      p.z * radius + (ring === 3 ? topZ : 0)
    ))
  )
  const positions: number[] = []
  const normals: number[] = []
  const face = (points: Vector3[]) => {
    const normal = points[1]!.clone().sub(points[0]!).cross(points[2]!.clone().sub(points[0]!)).normalize()
    for (let i = 1; i < points.length - 1; i++) {
      for (const p of [points[0]!, points[i]!, points[i + 1]!]) {
        positions.push(p.x, p.y, p.z)
        normals.push(normal.x, normal.y, normal.z)
      }
    }
  }
  for (let ring = 0; ring < rings.length - 1; ring++) {
    for (let i = 0; i < count; i++) {
      const next = (i + 1) % count
      face([rings[ring]![i]!, rings[ring + 1]![i]!, rings[ring + 1]![next]!, rings[ring]![next]!])
    }
  }
  face([...rings[0]!])
  face([...rings[rings.length - 1]!].reverse())
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3))
  return geometry
}
