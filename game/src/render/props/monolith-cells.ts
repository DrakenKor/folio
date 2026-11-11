import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three/webgpu'

export type Point = [number, number]
export interface Cut { a: Point; b: Point; width: number }

/** Subtracts finite groove strips, preserving all stone left between their junctions. */
export function carve(poly: Point[], cuts: Cut[]): Point[][] {
  let cells = [poly]
  for (const cut of cuts) {
    const dx = cut.b[0] - cut.a[0]
    const dy = cut.b[1] - cut.a[1]
    const length = Math.hypot(dx, dy)
    const nx = -dy / length * cut.width
    const ny = dx / length * cut.width
    const strip: Point[] = [
      [cut.a[0] + nx, cut.a[1] + ny], [cut.a[0] - nx, cut.a[1] - ny],
      [cut.b[0] - nx, cut.b[1] - ny], [cut.b[0] + nx, cut.b[1] + ny]
    ]
    cells = cells.flatMap(cell => {
      let inside: Point[] | undefined = cell
      const outside: Point[][] = []
      for (let i = 0; i < strip.length && inside; i++) {
        const a = strip[i]!
        const b = strip[(i + 1) % strip.length]!
        const parts: Point[][] = split(inside, { a, b, width: 0 })
        inside = undefined
        for (const part of parts) {
          const centre = part.reduce((s, p) => [s[0] + p[0] / part.length, s[1] + p[1] / part.length], [0, 0])
          if ((b[0] - a[0]) * (centre[1]! - a[1]) - (b[1] - a[1]) * (centre[0]! - a[0]) >= 0) inside = part
          else outside.push(part)
        }
      }
      return outside
    })
  }
  return cells
}

/** Splits convex stone cells along a cut's supporting line. */
export function split(poly: Point[], { a, b }: Cut): Point[][] {
  const left: Point[] = []
  const right: Point[] = []
  const side = (p: Point) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])
  poly.forEach((p, i) => {
    const q = poly[(i + 1) % poly.length]!
    const dp = side(p)
    const dq = side(q)
    if (dp >= -1e-7) left.push(p)
    if (dp <= 1e-7) right.push(p)
    if (dp * dq < -1e-12) {
      const t = dp / (dp - dq)
      const cross: Point = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]
      left.push(cross)
      right.push(cross)
    }
  })
  return [left, right].map(poly => poly.filter((p, i) => {
    const q = poly[(i + poly.length - 1) % poly.length]!
    return Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-7
  })).filter(p => area(p) > 1e-8)
}

function area(poly: Point[]): number {
  return poly.reduce((s, p, i) => { const q = poly[(i + 1) % poly.length]!; return s + p[0] * q[1] - p[1] * q[0] }, 0) / 2
}

/** Offsets each polygon edge by its groove width, discarding cells too small to survive the cut. */
export function inset(poly: Point[], widths: number[]): Point[] | null {
  const lines = poly.map((p, i) => {
    const q = poly[(i + 1) % poly.length]!
    const dx = q[0] - p[0]
    const dy = q[1] - p[1]
    const length = Math.hypot(dx, dy)
    return { x: p[0] - dy / length * widths[i]!, y: p[1] + dx / length * widths[i]!, dx, dy }
  })
  const result = lines.map((b, i): Point => {
    const a = lines[(i + lines.length - 1) % lines.length]!
    const det = a.dx * b.dy - a.dy * b.dx
    if (Math.abs(det) < 1e-10) return [b.x, b.y]
    const t = ((b.x - a.x) * b.dy - (b.y - a.y) * b.dx) / det
    return [a.x + a.dx * t, a.y + a.dy * t]
  })
  if (area(result) < 1e-7 || result.some(p => lines.some(l => l.dx * (p[1] - l.y) - l.dy * (p[0] - l.x) < -1e-6))) return null
  return result
}

/** Flat normals shade the cut walls; smooth hull normals keep the shared ink on the silhouette. */
export class StoneGeometry {
  private positions: number[] = []
  private normals: number[] = []
  private values: number[] = []
  private hull: number[] = []
  private uv: number[] = []

  polygon(points: Vector3[], value: number, uv?: Point[]): void {
    for (let i = 1; i < points.length - 1; i++) {
      const normal = points[i]!.clone().sub(points[0]!).cross(points[i + 1]!.clone().sub(points[0]!)).normalize()
      for (const j of [0, i, i + 1]) {
        const p = points[j]!
        this.positions.push(p.x, p.y, p.z)
        this.normals.push(normal.x, normal.y, normal.z)
        this.values.push(value)
        const hull = new Vector3(p.x, (p.y - 4.5) * 0.08, p.z).normalize()
        this.hull.push(hull.x, hull.y, hull.z)
        this.uv.push(...(uv?.[j] ?? [0, 0]))
      }
    }
  }

  build(): BufferGeometry {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(this.positions, 3))
    geometry.setAttribute('normal', new Float32BufferAttribute(this.normals, 3))
    geometry.setAttribute('stoneValue', new Float32BufferAttribute(this.values, 1))
    geometry.setAttribute('hull', new Float32BufferAttribute(this.hull, 3))
    geometry.setAttribute('carveUv', new Float32BufferAttribute(this.uv, 2))
    geometry.computeBoundingSphere()
    return geometry
  }
}
