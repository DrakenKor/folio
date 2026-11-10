import { ExtrudeGeometry, Group, Matrix4, Mesh, Shape, Vector3 } from 'three/webgpu'
import { abs, attribute, color, max, mix, mrt, normalWorld, positionLocal, sin, smoothstep, vec4 } from 'three/tsl'
import { GeometryBuilder, linearColor } from '../geometry'
import { CelMaterial } from '../materials/cel'
import type { Environment } from '../materials/environment'
import type { Heightfield } from '../terrain/heightfield'
import { climbingPulse, CYAN, MONOLITH_STONE, STONE_TURN } from './monolith-carving'
import { StoneGeometry, type Point } from './monolith-cells'

/** Three worn chamfered tiers, mossy on their upward edges, and a glowing groove cut into the ground around them. */
export function createMonolithSite(env: Environment, field: Heightfield): Group {
  const group = new Group()
  const builder = new GeometryBuilder()
  let y = 0
  for (const [size, height] of [[3.25, 0.43], [2.55, 0.40], [1.85, 0.42]] as Point[]) {
    const shape = tierShape(size)
    const geometry = new ExtrudeGeometry(shape, { depth: height - 0.16, bevelEnabled: true, bevelSize: 0.10, bevelThickness: 0.08, bevelSegments: 1, steps: 1 })
    const matrix = new Matrix4().makeRotationX(-Math.PI / 2).setPosition(0, y + 0.08, 0)
    builder.add(geometry, matrix, {
      color: linearColor(MONOLITH_STONE),
      vertex: p => ({ tierHalf: [size], hull: [p.x / size, 0.3, p.z / size] })
    })
    geometry.dispose()
    y += height
  }
  const edge = max(abs(positionLocal.x), abs(positionLocal.z)).div(attribute('tierHalf', 'float'))
  const patch = sin(positionLocal.x.mul(1.15).add(positionLocal.z.mul(0.55))).add(sin(positionLocal.z.mul(1.5))).mul(0.25).add(0.5)
  const moss = smoothstep(0.5, 0.85, edge).mul(smoothstep(0.2, 0.55, patch)).mul(smoothstep(0.7, 0.95, normalWorld.y))
  const material = new CelMaterial(env, {
    colorNode: mix(attribute('color', 'vec3'), color('#5f7a3c'), moss.mul(0.88)),
    outlineNormal: attribute('hull', 'vec3'),
    landmarkSpill: 0.75
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
  const corner = 0.35
  for (let side = 0; side < 4; side++) {
    const chip = Math.sin(size * 3 + side * 1.7) * size * 0.48
    const wear = 0.06 + (side % 3) * 0.035
    const edge: Point[] = [[-size + corner, -size], [chip - 0.20, -size], [chip - 0.10, -size + wear], [chip + 0.14, -size + wear * 0.9], [chip + 0.24, -size], [size - corner, -size]]
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
const RING_PROFILE: Point[] = [[0.34, -0.03], [0.24, 0.035], [0.19, 0.035], [0.15, 0.02]]

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
  const mesh = new Mesh(stone.build(), material)
  mesh.receiveShadow = true
  const glow = color(CYAN).mul(climbingPulse(env, 0).mul(0.25).add(0.7))
  const inlay = new CelMaterial(env, { color: '#2f3532', emissiveNode: glow, outlineColor: null })
  inlay.name = 'monolith-ring-groove'
  inlay.mrtNode = mrt({ glow: vec4(glow.mul(1.6), 1) })
  group.add(mesh, new Mesh(floor.build(), inlay))
  return group
}
