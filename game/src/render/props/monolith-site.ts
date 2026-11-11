import { ExtrudeGeometry, Group, Matrix4, Mesh, Shape, Vector3 } from 'three/webgpu'
import { abs, attribute, color, min, mix, mrt, positionLocal, vec4 } from 'three/tsl'
import { GeometryBuilder, linearColor } from '../geometry'
import { CelMaterial } from '../materials/cel'
import type { Environment } from '../materials/environment'
import type { Heightfield } from '../terrain/heightfield'
import { climbingPulse, CYAN, MONOLITH_STONE, STONE_TURN } from './monolith-carving'
import { StoneGeometry, type Point } from './monolith-cells'
import { smoothStoneNormals } from './stone-geometry'
import { stoneMoss } from './stone-moss'

/** Three worn chamfered tiers, mossy on their upward edges, and a glowing groove cut into the ground around them. */
export function createMonolithSite(env: Environment, field: Heightfield): Group {
  const group = new Group()
  const builder = new GeometryBuilder()
  let y = 0
  for (const [size, height] of [[3.25, 0.43], [2.55, 0.40], [1.85, 0.42]] as Point[]) {
    const shape = tierShape(size)
    const geometry = new ExtrudeGeometry(shape, { depth: height - 0.24, bevelEnabled: true, bevelSize: 0.16, bevelThickness: 0.12, bevelSegments: 2, steps: 1 })
    const positions = geometry.attributes.position!
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i)
      const z = positions.getY(i)
      const edge = Math.max(Math.abs(x), Math.abs(z)) / size
      const wear = Math.max(0, Math.sin(x * 2.1 + z * 1.7) - 0.15) * Math.max(0, edge - 0.65) * 0.28
      const top = Math.max(0, Math.min(1, (positions.getZ(i) + 0.12) / height))
      positions.setZ(i, positions.getZ(i) - wear * top)
    }
    smoothStoneNormals(geometry)
    const matrix = new Matrix4().makeRotationX(-Math.PI / 2).setPosition(0, y + 0.12, 0)
    builder.add(geometry, matrix, {
      color: linearColor(MONOLITH_STONE),
      vertex: p => ({ tierHalf: [size], hull: [p.x / size, 0.3, p.z / size] })
    })
    geometry.dispose()
    y += height
  }
  const corner = min(abs(positionLocal.x), abs(positionLocal.z)).div(attribute('tierHalf', 'float'))
  const moss = stoneMoss(corner.mul(0.30).sub(0.08))
  const material = new CelMaterial(env, {
    colorNode: mix(attribute('color', 'vec3'), color('#526d34'), moss.mul(0.95)),
    outlineNormal: attribute('hull', 'vec3'),
    outlineWidth: 0.7,
    landmarkSpill: 0.32
  })
  material.name = 'monolith-plinth'
  const plinth = new Mesh(builder.build(), material)
  plinth.rotation.y = STONE_TURN
  plinth.castShadow = plinth.receiveShadow = true
  group.add(plinth, carvedRing(env, field))
  return group
}

function tierShape(size: number): Shape {
  const shape = new Shape()
  for (let side = 0; side < 4; side++) {
    const corner = 0.28 + (Math.sin(size * 2 + side) * 0.5 + 0.5) * 0.24
    const chip = Math.sin(size * 3 + side * 1.7) * Math.min(size * 0.48, size - corner - 0.70)
    const wear = 0.12 + (side % 3) * 0.045
    const edge: Point[] = [[-size + corner, -size], [chip - 0.60, -size], [chip - 0.20, -size + wear], [chip + 0.20, -size + wear * 0.75], [chip + 0.65, -size], [size - corner, -size]]
    const angle = side * Math.PI / 2
    edge.forEach(([x, z], i) => {
      const u = x * Math.cos(angle) - z * Math.sin(angle)
      const v = x * Math.sin(angle) + z * Math.cos(angle)
      if (side === 0 && i === 0) shape.moveTo(u, v)
      else shape.lineTo(u, v)
    })
  }
  shape.closePath()
  return shape
}

const RING_RADIUS = 4.95
/** Groove cross-section from its outer edge to the floor: offset from the centre line, height above ground. */
const RING_PROFILE: Point[] = [[0.65, -0.03], [0.56, 0.10], [0.28, 0.16], [0.20, 0.16], [0.13, 0.055]]

function carvedRing(env: Environment, field: Heightfield): Group {
  const group = new Group()
  const stone = new StoneGeometry()
  const floor = new StoneGeometry()
  const at = (angle: number, offset: number, lift: number) => {
    const x = Math.cos(angle) * (RING_RADIUS + offset)
    const z = Math.sin(angle) * (RING_RADIUS + offset)
    return new Vector3(x, field.heightAt(field.monolith.x + x, field.monolith.z + z) - field.monolith.y + 0.25 + lift, z)
  }
  const segments = 96
  const [floorOffset, floorLift] = RING_PROFILE[RING_PROFILE.length - 1]!
  for (let s = 0; s < segments; s++) {
    const a0 = s / segments * Math.PI * 2
    const a1 = (s + 1) / segments * Math.PI * 2
    for (const side of [-1, 1]) {
      for (let i = 0; i < RING_PROFILE.length - 1; i++) {
        const [o0, h0] = RING_PROFILE[i]!
        const [o1, h1] = RING_PROFILE[i + 1]!
        const quad = [at(a0, side * o0, h0), at(a1, side * o0, h0), at(a1, side * o1, h1), at(a0, side * o1, h1)]
        stone.polygon(side > 0 ? quad.reverse() : quad, i === RING_PROFILE.length - 2 ? 0.66 : 1)
      }
    }
    floor.polygon([at(a0, -floorOffset, floorLift), at(a1, -floorOffset, floorLift), at(a1, floorOffset, floorLift), at(a0, floorOffset, floorLift)], 1)
  }
  const material = new CelMaterial(env, { colorNode: color(MONOLITH_STONE).mul(attribute('stoneValue', 'float')), outlineColor: null })
  material.name = 'monolith-ring-stone'
  const paving = stone.build()
  smoothStoneNormals(paving)
  const mesh = new Mesh(paving, material)
  mesh.receiveShadow = true
  const glow = color(CYAN).mul(climbingPulse(env, 0).mul(0.10).add(0.12))
  const inlay = new CelMaterial(env, { color: '#2f3532', emissiveNode: glow, outlineColor: null })
  inlay.name = 'monolith-ring-groove'
  inlay.mrtNode = mrt({ glow: vec4(glow, 1) })
  group.add(mesh, new Mesh(floor.build(), inlay))
  return group
}
