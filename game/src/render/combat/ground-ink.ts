import { BufferAttribute, BufferGeometry, DoubleSide, Group, Mesh, MeshBasicNodeMaterial } from 'three/webgpu'
import type { Footprint, Vec2 } from '../../sim/core/types'
import type { Heightfield } from '../terrain/heightfield'

export function offset(p: Vec2, heading: number, length: number, lateral = 0): Vec2 {
  const c = Math.cos(heading), s = Math.sin(heading)
  return { x: p.x + c * length - s * lateral, z: p.z + s * length + c * lateral }
}

export function perimeter(f: Footprint, rectangle = false): Vec2[] {
  const { origin, direction, reach, halfWidth, radius, arcRadians } = f
  const point = (x: number, z: number) => offset(origin, direction, x, z)
  if (rectangle) return [point(-radius, 0), point(0, radius), point(radius, 0), point(0, -radius)]
  if (f.kind === 'lane') {
    const cap = (x: number, start: number) => Array.from({ length: 9 }, (_, i) => {
      const a = start + i * Math.PI / 8
      return point(x + Math.cos(a) * halfWidth, Math.sin(a) * halfWidth)
    })
    return [...cap(reach, -Math.PI / 2), ...cap(0, Math.PI / 2)]
  }
  const disc = f.kind === 'disc'
  const arc = disc ? 2 * Math.PI : arcRadians
  const samples = Array.from({ length: disc ? 32 : 25 }, (_, i) =>
    offset(origin, direction - arc / 2 + i * arc / (disc ? 32 : 24), disc ? radius : reach))
  return disc ? samples : [origin, ...samples]
}

export interface Ink extends Group {
  fill: Mesh<BufferGeometry, MeshBasicNodeMaterial>
  edge: Mesh<BufferGeometry, MeshBasicNodeMaterial>
}

export function makeInk(fill: number, rim: number, order: number): Ink {
  const mesh = (color: number, renderOrder: number) => {
    const part = new Mesh(new BufferGeometry(), new MeshBasicNodeMaterial({
      color, transparent: true, depthWrite: false, side: DoubleSide
    }))
    part.renderOrder = renderOrder
    return part
  }
  const ink = Object.assign(new Group(), { fill: mesh(fill, order), edge: mesh(rim, order + 1) })
  ink.add(ink.fill, ink.edge)
  return ink
}

export function inkShape(ink: Ink, field: Heightfield, points: Vec2[], center: Vec2, width: number) {
  const fill: number[] = [], edge: number[] = []
  const verts = (p: Vec2, lift: number) => {
    const x = p.x + field.player.x, z = p.z + field.player.z
    return [x, field.heightAt(x, z) + lift, z]
  }
  const between = (a: Vec2, b: Vec2, t: number) => ({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t })
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!, q = points[(i + 1) % points.length]!
    const length = Math.hypot(q.x - p.x, q.z - p.z)
    const cuts = Math.max(1, Math.ceil(length / .5))
    for (let j = 0; j < cuts; j++) {
      const a = between(p, q, j / cuts), b = between(p, q, (j + 1) / cuts)
      for (let k = 0; k < 4; k++) {
        const sa = between(center, a, k / 4), sb = between(center, b, k / 4)
        const ea = between(center, a, (k + 1) / 4), eb = between(center, b, (k + 1) / 4)
        fill.push(...verts(sa, .073), ...verts(ea, .073), ...verts(eb, .073), ...verts(sa, .073), ...verts(eb, .073), ...verts(sb, .073))
      }
      const direction = Math.atan2(b.z - a.z, b.x - a.x)
      const a0 = verts(offset(a, direction, 0, -width / 2), .08), a1 = verts(offset(a, direction, 0, width / 2), .08)
      const b0 = verts(offset(b, direction, 0, -width / 2), .08), b1 = verts(offset(b, direction, 0, width / 2), .08)
      edge.push(...a0, ...b0, ...b1, ...a0, ...b1, ...a1)
    }
  }
  updateGeometry(ink.fill.geometry, fill)
  updateGeometry(ink.edge.geometry, edge)
}

export function updateGeometry(geometry: BufferGeometry, values: number[]) {
  const previous = geometry.getAttribute('position')
  if (previous?.count === values.length / 3) {
    previous.array.set(values)
    previous.needsUpdate = true
  } else geometry.setAttribute('position', new BufferAttribute(new Float32Array(values), 3))
  geometry.computeBoundingSphere()
}

export function disposeInk(ink: Ink) {
  ink.removeFromParent()
  for (const part of [ink.fill, ink.edge]) {
    part.geometry.dispose()
    part.material.dispose()
  }
}
