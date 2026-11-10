import { ExtrudeGeometry, Group, Matrix4, Mesh, Shape, Vector3 } from 'three/webgpu'
import { abs, attribute, color, max, mix, mrt, normalWorld, positionLocal, sin, smoothstep, vec4 } from 'three/tsl'
import { GeometryBuilder, linearColor } from '../geometry'
import { CelMaterial } from '../materials/cel'
import type { Environment } from '../materials/environment'
import type { Heightfield } from '../terrain/heightfield'
import { STONE_TURN } from './monolith-carving'
import { carve, inset, StoneGeometry, type Cut, type Point } from './monolith-cells'

/** Three worn chamfered tiers and a terrain-conforming ring of nested diamond cuts. */
export function createMonolithSite(env: Environment, field: Heightfield): Group {
  const group = new Group()
  const builder = new GeometryBuilder()
  let y = 0
  for (const [size, height] of [[3.25, 0.43], [2.55, 0.40], [1.85, 0.42]] as Point[]) {
    const shape = tierShape(size)
    const geometry = new ExtrudeGeometry(shape, { depth: height - 0.16, bevelEnabled: true, bevelSize: 0.10, bevelThickness: 0.08, bevelSegments: 1, steps: 1 })
    const matrix = new Matrix4().makeRotationX(-Math.PI / 2).setPosition(0, y + 0.08, 0)
    builder.add(geometry, matrix, {
      color: linearColor('#b4ac99'),
      vertex: p => ({ tierHalf: [size], hull: [p.x / size, 0.3, p.z / size] })
    })
    geometry.dispose()
    y += height
  }
  const edge = max(abs(positionLocal.x), abs(positionLocal.z)).div(attribute('tierHalf', 'float'))
  const patch = sin(positionLocal.x.mul(1.15).add(positionLocal.z.mul(0.55))).add(sin(positionLocal.z.mul(1.5))).mul(0.25).add(0.5)
  const moss = smoothstep(0.68, 0.95, edge).mul(smoothstep(0.35, 0.7, patch)).mul(smoothstep(0.65, 0.92, normalWorld.y))
  const material = new CelMaterial(env, {
    colorNode: mix(attribute('color', 'vec3'), color('#697b45'), moss.mul(0.8)),
    outlineNormal: attribute('hull', 'vec3')
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
  const edge: Point[] = [[-size + corner, -size], [-size * 0.4, -size], [-size * 0.34, -size + 0.065], [-size * 0.24, -size + 0.07], [-size * 0.18, -size], [size * 0.57, -size], [size * 0.61, -size + 0.10], [size * 0.69, -size], [size - corner, -size]]
  for (let side = 0; side < 4; side++) {
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

function carvedRing(env: Environment, field: Heightfield): Group {
  const group = new Group()
  const top = new StoneGeometry()
  const floor = new StoneGeometry()
  const diamond: Point[] = [[0, -0.22], [0.85, 0], [0, 0.22], [-0.85, 0]]
  const cuts: Cut[] = diamond.map((a, i) => ({ a, b: diamond[(i + 1) % 4]!, width: 0.028 }))
  cuts.push({ a: [-1, 0], b: [1, 0], width: 0.025 })
  const cells = carve([[-1, -0.34], [1, -0.34], [1, 0.34], [-1, 0.34]], cuts)
  const point = ([u, r]: Point, section: number, height: number) => {
    const angle = (section + (u + 1) / 2) / 16 * Math.PI * 2
    const x = Math.cos(angle) * (4.95 + r)
    const z = Math.sin(angle) * (4.95 + r)
    return new Vector3(x, field.heightAt(field.monolith.x + x, field.monolith.z + z) - field.monolith.y + 0.25 + height, z)
  }
  for (let section = 0; section < 16; section++) {
    for (const cell of cells) {
      const outer = inset(cell, cell.map(() => -0.01)) ?? cell
      top.polygon(cell.map(p => point(p, section, 0.20)), 1)
      for (let i = 0; i < cell.length; i++) {
        const j = (i + 1) % cell.length
        top.polygon([point(cell[i]!, section, 0.20), point(outer[i]!, section, 0.08), point(outer[j]!, section, 0.08), point(cell[j]!, section, 0.20)], 0.65)
      }
    }
    for (let part = 0; part < 8; part++) {
      const u = part / 4 - 1
      const v = (part + 1) / 4 - 1
      floor.polygon([[u, -0.34], [v, -0.34], [v, 0.34], [u, 0.34]].map(p => point(p as Point, section, 0.079)), 1)
    }
  }
  const stone = new CelMaterial(env, { colorNode: color('#aca38e').mul(attribute('stoneValue', 'float')), outlineColor: null })
  stone.name = 'monolith-ring-stone'
  const mesh = new Mesh(top.build(), stone)
  mesh.receiveShadow = true
  const glow = color('#65e9df').mul(0.32)
  const inlay = new CelMaterial(env, { color: '#48473e', emissiveNode: glow, outlineColor: null })
  inlay.name = 'monolith-ring-grooves'
  inlay.mrtNode = mrt({ glow: vec4(glow, 1) })
  group.add(mesh, new Mesh(floor.build(), inlay))
  return group
}
