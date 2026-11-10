import { Group, Mesh, Vector3, type Node } from 'three/webgpu'
import { abs, attribute, color, float, max, mod, mrt, smoothstep, vec2, vec4 } from 'three/tsl'
import { CelMaterial } from '../materials/cel'
import type { Environment } from '../materials/environment'
import { carve, inset, split, StoneGeometry, type Cut, type Point } from './monolith-cells'

export const SHAFT_BASE = 1.25
export const SHAFT_HEIGHT = 6.6
export const STONE_TURN = -0.24
export const MONOLITH_STONE = '#a59e90'
export const CYAN = '#65e9df'
export const CRYSTAL_RISE = SHAFT_HEIGHT + 2.05
const GROOVE_DEPTH = 0.025
const DIAMONDS: Point[] = [[0.76, 2.22], [0.40, 1.17]]
const DIAMOND_CENTRE = 2.55
const LATTICE_ROWS = [4.65, 5.30, 5.95, SHAFT_HEIGHT]

/** A broad, calm crest climbs to the crystal and leaves a short luminous wake. */
export function climbingPulse(env: Environment, height: number | Node<'float'>): Node<'float'> {
  const behind = mod(env.time.mul(1.45).add(12.9), 13).sub(0.6).sub(height)
  return smoothstep(-0.40, 0.06, behind).mul(smoothstep(0.55, 2.1, behind).oneMinus())
}

/** The stone face stays continuous except at the designed, recessed grooves. */
export function createCarvedShaft(env: Environment): Group {
  const group = new Group()
  group.rotation.y = STONE_TURN
  const cuts = carvingCuts()
  let cells = carve([[-1, 0], [1, 0], [1, SHAFT_HEIGHT], [-1, SHAFT_HEIGHT]], cuts)
  for (const u of [-0.93, 0.93]) cells = cells.flatMap(cell => split(cell, { a: [u, 0], b: [u, SHAFT_HEIGHT], width: 0 }))
  const surface = new StoneGeometry()
  const floor = new StoneGeometry()
  const cap = new StoneGeometry()
  for (let face = 0; face < 4; face++) {
    for (const cell of cells) {
      const top = cell.map(p => facePoint(p, face, 0))
      const boundaries = cell.map((a, i) => grooveBoundary(a, cell[(i + 1) % cell.length]!, cuts))
      const lower = inset(cell, boundaries.map(cut => -(cut?.width ?? 0) * 0.38)) ?? cell
      surface.polygon(top, 1, cell.map(faceUv))
      const at = (k: number, scale: number, depth: number) => facePoint([
        cell[k]![0] + (lower[k]![0] - cell[k]![0]) * scale,
        cell[k]![1] + (lower[k]![1] - cell[k]![1]) * scale
      ], face, GROOVE_DEPTH * depth)
      for (let i = 0; i < cell.length; i++) {
        const j = (i + 1) % cell.length
        if (!boundaries[i]) continue
        const profiles: Point[] = [[0, 0], [0.35, 0.76], [1, 1]]
        for (let level = 0; level < 2; level++) {
          const [s0, d0] = profiles[level]!
          const [s1, d1] = profiles[level + 1]!
          surface.polygon([at(i, s0, d0), at(i, s1, d1), at(j, s1, d1), at(j, s0, d0)], level === 0 ? 0.56 : 0.88)
        }
      }
    }
    for (const [left, right] of [[-1, -0.93], [-0.93, 0.93], [0.93, 1]] as Point[]) {
      const quad: Point[] = [[left, 0], [right, 0], [right, SHAFT_HEIGHT], [left, SHAFT_HEIGHT]]
      floor.polygon(quad.map(p => facePoint(p, face, GROOVE_DEPTH + 0.002)), 1, quad.map(faceUv))
      cap.polygon([facePoint([left, SHAFT_HEIGHT], face, 0), facePoint([right, SHAFT_HEIGHT], face, 0), new Vector3(0, SHAFT_BASE + SHAFT_HEIGHT + 0.95, 0)], 1)
    }
  }
  const material = new CelMaterial(env, {
    colorNode: color(MONOLITH_STONE).mul(attribute('stoneValue', 'float')),
    outlineColor: null, landmarkSpill: 0.15
  })
  material.name = 'monolith-stone'
  const mesh = new Mesh(surface.build(), material)
  mesh.castShadow = mesh.receiveShadow = true
  group.add(mesh)
  const crownMaterial = new CelMaterial(env, { color: MONOLITH_STONE, outlineNormal: attribute('hull', 'vec3'), landmarkSpill: 0.15 })
  crownMaterial.name = 'monolith-cap'
  const crown = new Mesh(cap.build(), crownMaterial)
  crown.castShadow = true
  group.add(crown)

  const glow = grooveGlow(env)
  const inlay = new CelMaterial(env, {
    color: '#56605b', emissiveNode: glow, landmarkSpill: 0.15,
    outlineColor: null
  })
  inlay.name = 'monolith-groove-floor'
  inlay.mrtNode = mrt({ glow: vec4(glow.mul(1.7), 1) })
  const grooveFloor = new Mesh(floor.build(), inlay)
  grooveFloor.receiveShadow = true
  group.add(grooveFloor)
  return group
}

/** Only exposed cut boundaries have walls; polygon partition edges stay flush. */
function grooveBoundary(a: Point, b: Point, cuts: Cut[]): Cut | undefined {
  const x = (a[0] + b[0]) * 0.5
  const y = (a[1] + b[1]) * 0.5
  return cuts.find(cut => {
    const dx = cut.b[0] - cut.a[0]
    const dy = cut.b[1] - cut.a[1]
    const length = Math.hypot(dx, dy)
    const along = ((x - cut.a[0]) * dx + (y - cut.a[1]) * dy) / length
    const across = Math.abs((x - cut.a[0]) * dy - (y - cut.a[1]) * dx) / length
    return along > -1e-6 && along < length + 1e-6 && Math.abs(across - cut.width) < 1e-6
  })
}

/** The spine carries the crest; diamonds and triangular cells illuminate in its wake. */
function grooveGlow(env: Environment): Node<'vec3'> {
  const uv = carvingUv()
  const spine = smoothstep(0.025, 0.078, abs(uv.x)).oneMinus()
  let diamond: Node<'float'> = float(0)
  for (const [width, height] of DIAMONDS) {
    const distance = abs(abs(uv.x).div(width).add(abs(uv.y.sub(DIAMOND_CENTRE)).div(height)).sub(1)).mul(width)
    diamond = max(diamond, smoothstep(0.012, 0.040, distance).oneMinus())
  }
  const pulse = climbingPulse(env, uv.y)
  const lit = spine.mul(pulse.mul(3.6).add(0.42)).max(diamond.mul(pulse.mul(1.15).add(0.30)))
  const lattice = smoothstep(4.63, 4.67, uv.y).mul(latticeWake(env).mul(1.5).add(0.13))
  return color(CYAN).mul(lit.max(lattice))
}

/** Triangular cells respond after the crest, with the outside cells following the centre. */
function latticeWake(env: Environment): Node<'float'> {
  const uv = carvingUv()
  let energy: Node<'float'> = float(0)
  for (let band = 0; band < 3; band++) {
    const low = LATTICE_ROWS[band]!
    const high = LATTICE_ROWS[band + 1]!
    const count = 2 ** band
    const cell = uv.x.add(1).mul(count / 2).floor().add(0.5).mul(2 / count).sub(1)
    const wake = climbingPulse(env, cell.abs().mul(0.25).add((low + high) * 0.5 + 0.45))
    const region = smoothstep(low - 0.02, low + 0.02, uv.y).mul(smoothstep(high - 0.02, high + 0.02, uv.y).oneMinus())
    energy = max(energy, region.mul(wake))
  }
  return energy
}

/** Interpolate physical face coordinates before undoing the shaft's taper. */
function faceUv([u, y]: Point): Point {
  return [u * (1.24 - y / SHAFT_HEIGHT * 0.40), y]
}

function carvingUv(): Node<'vec2'> {
  const p = attribute('carveUv', 'vec2')
  return vec2(p.x.div(p.y.mul(-0.40 / SHAFT_HEIGHT).add(1.24)), p.y)
}

/** Two nested diamonds lead into triangular rows doubling towards the crown. */
function carvingCuts(): Cut[] {
  const cuts: Cut[] = [{ a: [0, 0], b: [0, SHAFT_HEIGHT], width: 0.11 }]
  for (const [width, height] of DIAMONDS) {
    const diamond: Point[] = [[0, DIAMOND_CENTRE - height], [width, DIAMOND_CENTRE], [0, DIAMOND_CENTRE + height], [-width, DIAMOND_CENTRE]]
    diamond.forEach((a, i) => cuts.push({ a, b: diamond[(i + 1) % 4]!, width: 0.048 }))
  }
  for (let band = 0; band < 3; band++) {
    const count = 2 ** band
    const low = LATTICE_ROWS[band]!
    const high = LATTICE_ROWS[band + 1]!
    cuts.push({ a: [-1, low], b: [1, low], width: 0.023 })
    for (let i = 0; i < count; i++) {
      const left = -1 + i * 2 / count
      const right = -1 + (i + 1) * 2 / count
      const tip: Point = [(left + right) * 0.5, high]
      cuts.push({ a: [left, low], b: tip, width: 0.023 }, { a: tip, b: [right, low], width: 0.023 })
    }
  }
  return cuts
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
