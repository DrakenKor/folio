import { Group, Mesh, Vector3, type Node } from 'three/webgpu'
import { abs, attribute, color, float, max, mod, mrt, smoothstep, vec4 } from 'three/tsl'
import { CelMaterial, inkColor } from '../materials/cel'
import type { Environment } from '../materials/environment'
import { carve, inset, split, StoneGeometry, type Cut, type Point } from './monolith-cells'

export const SHAFT_BASE = 1.25
export const SHAFT_HEIGHT = 6.6
export const STONE_TURN = -0.24

/** One calm pulse, followed by a soft release, travelling from the foot to the crystal. */
export function climbingPulse(env: Environment, height: number | Node<'float'>): Node<'float'> {
  const behind = mod(env.time.mul(0.8).add(1.3), SHAFT_HEIGHT + 2.4).sub(1).sub(height)
  return smoothstep(-0.3, 0.08, behind).mul(smoothstep(0.4, 1.5, behind).oneMinus())
}

/** Convex stone cells have bevelled walls down to a continuous, recessed luminous floor. */
export function createCarvedShaft(env: Environment): Group {
  const group = new Group()
  group.rotation.y = STONE_TURN
  const cuts = carvingCuts()
  const seams: Cut[] = [-0.93, 0.93].map(u => ({ a: [u, 0], b: [u, SHAFT_HEIGHT], width: 0 }))
  let cells = carve([[-1, 0], [1, 0], [1, SHAFT_HEIGHT], [-1, SHAFT_HEIGHT]], cuts)
  for (const cut of seams) cells = cells.flatMap(cell => split(cell, cut))
  const surface = new StoneGeometry()
  const floor = new StoneGeometry()
  const cap = new StoneGeometry()
  for (let face = 0; face < 4; face++) {
    for (const cell of cells) {
      const bottom = inset(cell, cell.map(() => -0.012)) ?? cell
      const top3 = cell.map(p => facePoint(p, face, 0))
      const bottom3 = bottom.map(p => facePoint(p, face, 0.045))
      surface.polygon(top3, 1)
      for (let i = 0; i < cell.length; i++) {
        const j = (i + 1) % cell.length
        surface.polygon([top3[i]!, bottom3[i]!, bottom3[j]!, top3[j]!], 0.75)
      }
    }
    for (const [left, right] of [[-1, -0.93], [-0.93, 0.93], [0.93, 1]] as Point[]) {
      const quad: Point[] = [[left, 0], [right, 0], [right, SHAFT_HEIGHT], [left, SHAFT_HEIGHT]]
      floor.polygon(quad.map(p => facePoint(p, face, 0.046)), 1, quad)
      cap.polygon([facePoint([left, SHAFT_HEIGHT], face, 0), facePoint([right, SHAFT_HEIGHT], face, 0), new Vector3(0, SHAFT_BASE + SHAFT_HEIGHT + 0.95, 0)], 1.06)
    }
  }
  const material = new CelMaterial(env, {
    colorNode: color('#969184').mul(attribute('stoneValue', 'float')),
    outlineColor: null
  })
  material.name = 'monolith-stone'
  const mesh = new Mesh(surface.build(), material)
  mesh.castShadow = mesh.receiveShadow = true
  group.add(mesh)
  const crown = new Mesh(cap.build(), new CelMaterial(env, { color: '#969184', outlineNormal: attribute('hull', 'vec3') }))
  crown.castShadow = true
  group.add(crown)

  const uv = attribute('carveUv', 'vec2')
  const diamond = (width: number, height: number) => abs(abs(uv.x).div(width).add(abs(uv.y.sub(SHAFT_HEIGHT / 2)).div(height)).sub(1)).mul(width)
  const primaryDistance = uv.x.abs().min(diamond(0.88, 3.12)).min(diamond(0.60, 2.12)).min(diamond(0.32, 1.12))
  const primary = smoothstep(0.025, 0.065, primaryDistance).oneMinus()
  const pulse = climbingPulse(env, uv.y)
  const subdivision = float(2).pow(uv.y.div(2.2).floor().clamp(0, 2))
  const row = uv.y.mul(subdivision).div(2.2).floor().add(0.5).mul(2.2).div(subdivision)
  const sequence = climbingPulse(env, row)
  const energy = max(primary.mul(pulse.mul(0.8).add(0.75)), sequence.mul(0.28).add(0.15))
  const glow = color('#65e9df').mul(energy)
  const inlay = new CelMaterial(env, {
    color: '#42443e', emissiveNode: glow,
    outlineColor: inkColor(env, color('#969184').rgb), outlineNormal: attribute('hull', 'vec3')
  })
  inlay.name = 'monolith-groove-floor'
  inlay.mrtNode = mrt({ glow: vec4(glow, 1) })
  group.add(new Mesh(floor.build(), inlay))
  return group
}

/** A spine and three nested diamonds over a triangular grid of 1, 2, then 4 subdivisions. */
function carvingCuts(): Cut[] {
  const cuts: Cut[] = [{ a: [0, 0], b: [0, SHAFT_HEIGHT], width: 0.065 }]
  for (const [width, height] of [[0.88, 3.12], [0.60, 2.12], [0.32, 1.12]] as Point[]) {
    const diamond: Point[] = [[0, 3.3 - height], [width, 3.3], [0, 3.3 + height], [-width, 3.3]]
    diamond.forEach((a, i) => cuts.push({ a, b: diamond[(i + 1) % 4]!, width: 0.05 }))
  }
  for (let band = 0; band < 3; band++) {
    const count = 2 ** band
    const y = band * 2.2
    for (let k = 0; k <= count; k++) cuts.push({ a: [-1, y + k * 2.2 / count], b: [1, y + k * 2.2 / count], width: 0.022 })
    for (const slope of [-1, 1]) {
      for (let k = -count; k <= count * 2; k++) {
        const a: Point = [-1, y + k * 2.2 / count]
        const b: Point = [1, a[1] + slope * 2.2]
        const ends = clipBand(a, b, y, y + 2.2)
        if (ends) cuts.push({ a: ends[0], b: ends[1], width: 0.022 })
      }
    }
  }
  return cuts
}

function clipBand(a: Point, b: Point, low: number, high: number): [Point, Point] | null {
  const dy = b[1] - a[1]
  const t0 = Math.max(0, Math.min((low - a[1]) / dy, (high - a[1]) / dy))
  const t1 = Math.min(1, Math.max((low - a[1]) / dy, (high - a[1]) / dy))
  if (t1 - t0 < 1e-6) return null
  const at = (t: number): Point => [a[0] + (b[0] - a[0]) * t, a[1] + dy * t]
  return [at(t0), at(t1)]
}

function facePoint([u, y]: Point, face: number, depth: number): Vector3 {
  const half = 1.24 - y / SHAFT_HEIGHT * 0.40
  const corner = Math.max(0, Math.abs(u) - 0.93) / 2
  const bevel = Math.min(1, corner / 0.035)
  const x = (u - Math.sign(u) * corner) * half - Math.sign(u) * depth * bevel * 0.5
  const z = (1 - corner) * half - depth * (1 - bevel * 0.5)
  const angle = face * Math.PI / 2
  return new Vector3(x * Math.cos(angle) + z * Math.sin(angle), SHAFT_BASE + y, z * Math.cos(angle) - x * Math.sin(angle))
}
