// The geometric monolith: a dark hexagonal obelisk on a stepped octagonal
// platform, inlaid with a partial triangular lattice that glows and pulses
// upward. A crystal floats above it and motes of light drift around it.
// Only the glow lands in the bloom target.
import { ConeGeometry, CylinderGeometry, Group, InstancedBufferGeometry, Matrix4, Mesh, OctahedronGeometry, Vector3, type BufferGeometry, type Node } from 'three/webgpu'
import {
  abs,
  atan,
  color,
  float,
  floor,
  fract,
  Fn,
  fwidth,
  hash,
  instanceIndex,
  max,
  min,
  mrt,
  normalLocal,
  positionLocal,
  sin,
  cos,
  smoothstep,
  step,
  vec2,
  vec3,
  vec4,
  attribute
} from 'three/tsl'
import { GeometryBuilder, linearColor } from '../geometry'
import { CelMaterial } from '../materials/cel'
import type { Environment } from '../materials/environment'
import type { Heightfield } from '../terrain/heightfield'

const MONOLITH_HEIGHT = 7.2
const GLOW = '#4ff0de'

export function createMonolith(env: Environment, field: Heightfield) {
  const group = new Group()
  group.name = 'monolith'
  const { x, y, z } = field.monolith
  group.position.set(x, y - 0.25, z)

  // Platform: two octagonal slabs.
  const platform = new GeometryBuilder()
  const slab = (r0: number, r1: number, h: number, at: number) => {
    const g = new CylinderGeometry(r0, r1, h, 8, 1)
    platform.add(g, new Matrix4().makeTranslation(0, at + h / 2, 0), {
      color: linearColor('#b5ad9e'),
      vertex: (p) => {
        const d = new Vector3(p.x, (p.y - at - h / 2) * 1.5, p.z).normalize()
        return { hull: [d.x, d.y, d.z] }
      }
    })
  }
  slab(5.0, 5.5, 0.7, -0.4)
  slab(3.3, 3.7, 0.45, 0.3)
  const stoneMaterial = new CelMaterial(env, {
    colorNode: attribute('color', 'vec3'),
    flatShading: true,
    outlineColor: vec3(0.12, 0.1, 0.12),
    outlineNormal: attribute('hull', 'vec3'),
    outlineWidth: 1
  })
  stoneMaterial.name = 'platform'
  const platformMesh = new Mesh(platform.build(), stoneMaterial)
  platformMesh.castShadow = platformMesh.receiveShadow = true
  group.add(platformMesh)

  // The obelisk: a tapering hexagonal shaft with a pointed cap.
  const shaft = new GeometryBuilder()
  const base = 0.75
  const shaftGeo = new CylinderGeometry(0.62, 0.95, MONOLITH_HEIGHT, 6, 1)
  const tip = new ConeGeometry(0.62, 1.1, 6, 1)
  const hullOf = (p: Vector3) => {
    const d = new Vector3(p.x, (p.y - base - MONOLITH_HEIGHT / 2) * 0.25, p.z).normalize()
    return { hull: [d.x, d.y, d.z] }
  }
  shaft.add(shaftGeo, new Matrix4().makeTranslation(0, base + MONOLITH_HEIGHT / 2, 0), { color: linearColor('#3a4560'), vertex: hullOf })
  shaft.add(tip, new Matrix4().makeTranslation(0, base + MONOLITH_HEIGHT + 0.55, 0), { color: linearColor('#3a4560'), vertex: hullOf })

  const glow = lattice(env)
  const shaftMaterial = new CelMaterial(env, {
    colorNode: attribute('color', 'vec3'),
    emissiveNode: glow,
    flatShading: true,
    outlineColor: vec3(0.02, 0.025, 0.06),
    outlineNormal: attribute('hull', 'vec3'),
    outlineWidth: 1.25
  })
  shaftMaterial.mrtNode = mrt({ glow: vec4(glow, 1) })
  shaftMaterial.name = 'monolith'
  const shaftMesh = new Mesh(shaft.build(), shaftMaterial)
  shaftMesh.castShadow = shaftMesh.receiveShadow = true
  group.add(shaftMesh)

  // Floating crystal.
  const crystalGeo = new OctahedronGeometry(0.5, 0)
  crystalGeo.scale(1, 1.7, 1)
  const crystalGlow = color(GLOW).mul(sin(env.time.mul(1.3)).mul(0.25).add(0.9)).mul(normalLocal.y.abs().mul(0.6).add(0.5))
  const crystalMaterial = new CelMaterial(env, {
    color: 0xc9fbf4,
    emissiveNode: crystalGlow.mul(0.9),
    flatShading: true,
    outlineColor: vec3(0.02, 0.12, 0.14),
    outlineWidth: 1
  })
  crystalMaterial.mrtNode = mrt({ glow: vec4(crystalGlow.mul(1.1), 1) })
  crystalMaterial.name = 'crystal'
  const crystal = new Mesh(crystalGeo, crystalMaterial)
  crystal.castShadow = true
  const crystalHeight = base + MONOLITH_HEIGHT + 2.3
  crystal.position.y = crystalHeight
  group.add(crystal)

  group.add(createMotes(env, base + MONOLITH_HEIGHT))

  return {
    group,
    /** Scene-time animation of the crystal. */
    update(time: number) {
      crystal.rotation.y = time * 0.5
      crystal.position.y = crystalHeight + Math.sin(time * 0.9) * 0.18
    }
  }
}

/** The glowing inlay: a triangular lattice, partly lit, pulsing upward. */
function lattice(env: Environment) {
  return Fn(() => {
    const p = positionLocal
    const sector = float(Math.PI / 3)
    const angle = atan(p.z, p.x).add(Math.PI)
    const along = fract(angle.div(sector))
    const faceIndex = floor(angle.div(sector))
    const radius = vec2(p.x, p.z).length()
    // Face-local coordinates in metres: across the face and up the shaft.
    const uv = vec2(along.sub(0.5).mul(radius).mul(1.1), p.y).mul(1.9)
    const q = vec2(uv.x.add(uv.y.mul(0.57735)), uv.y.mul(1.1547))
    const f = fract(q)
    const d1 = min(f.x, f.x.oneMinus())
    const d2 = min(f.y, f.y.oneMinus())
    const d3 = abs(f.x.sub(f.y))
    const upper = step(f.y, f.x)
    const cell = floor(q).add(vec2(upper, 0))
    const lit = step(0.5, hash(cell.x.add(37).mul(131).add(cell.y.add(91)).add(faceIndex.mul(977)).toUint()))
    const line = (d: Node<'float'>) => {
      const w = fwidth(d).max(1e-4)
      return smoothstep(w.mul(1.6).add(0.035), float(0.035), d)
    }
    const lines = max(line(d1), max(line(d2), line(d3))).mul(lit)
    // Lattice nodes always glow a little.
    const node = smoothstep(0.16, 0.08, vec2(min(f.x, f.x.oneMinus()), min(f.y, f.y.oneMinus())).length())
    // Faces only: the caps and the platform end stay dark.
    const onFace = step(abs(normalLocal.y), 0.6).mul(step(1.2, p.y)).mul(step(p.y, MONOLITH_HEIGHT + 0.5))
    const pulse = smoothstep(0.55, 1, sin(p.y.mul(1.3).sub(env.time.mul(1.7))).mul(0.5).add(0.5))
    const intensity = pulse.mul(2.2).add(0.55)
    return color(GLOW).mul(max(lines, node.mul(0.8))).mul(intensity).mul(onFace)
  })()
}

/** Small glowing motes drifting up around the monolith. */
function createMotes(env: Environment, height: number): Mesh {
  const count = 56
  const source: BufferGeometry = new OctahedronGeometry(0.05, 0)
  const geometry = new InstancedBufferGeometry()
  geometry.index = source.index
  geometry.setAttribute('position', source.attributes.position!)
  geometry.setAttribute('normal', source.attributes.normal!)
  geometry.instanceCount = count
  const r0 = hash(instanceIndex)
  const r1 = hash(instanceIndex.add(101))
  const r2 = hash(instanceIndex.add(211))
  const life = fract(env.time.mul(r1.mul(0.05).add(0.04)).add(r0))
  const angle = r2.mul(6.283).add(env.time.mul(0.25)).add(life.mul(2))
  const dist = r0.mul(2.6).add(1.2)
  const centre = vec3(cos(angle).mul(dist), life.mul(height + 2).add(0.6), sin(angle).mul(dist))
  const fade = smoothstep(0, 0.15, life).mul(smoothstep(1, 0.7, life))
  const material = new CelMaterial(env, { outlineColor: null, color: 0xffffff })
  material.positionNode = positionLocal.mul(fade.mul(1.4).add(0.2)).add(centre)
  const glow = color(GLOW).mul(fade).mul(2.5)
  material.colorNode = vec4(color('#d9fffa'), 1)
  material.emissiveNode = glow
  material.mrtNode = mrt({ glow: vec4(glow, 1) })
  material.name = 'motes'
  const mesh = new Mesh(geometry, material)
  mesh.frustumCulled = false
  return mesh
}

