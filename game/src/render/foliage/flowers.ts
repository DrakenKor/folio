// Small star-shaped flowers in drifts through the grass. They ride the same
// world-anchored grid as the grass, on coarser cells, and nod in the wind.
import { BufferAttribute, InstancedBufferGeometry, Mesh, DoubleSide } from 'three/webgpu'
import { attribute, color, cos, float, floor, Fn, hash, instanceIndex, mix, mod, sin, smoothstep, step, texture, vec2, vec3, vec4, positionGeometry, varyingProperty } from 'three/tsl'
import { CelMaterial } from '../materials/cel'
import type { Environment } from '../materials/environment'
import { gustAt } from '../materials/wind'
import { GRID, type Heightfield, TERRAIN_HALF } from '../terrain/heightfield'
import type { createGrass } from './grass'

const SIDE = 112
/** Flower cells are this many grass cells wide. */
const CELL_RATIO = 3.5

export function createFlowers(env: Environment, field: Heightfield, grass: ReturnType<typeof createGrass>) {
  const geometry = starGeometry()
  geometry.instanceCount = SIDE * SIDE
  const { focus, player, cell: grassCell, height: grassHeight, shortenRadius } = grass.uniforms
  const vKind = varyingProperty('float', 'vFlowerKind')
  const side = float(SIDE)

  const positionNode = Fn(() => {
    const cellSize = grassCell.mul(CELL_RATIO)
    const index = instanceIndex.toFloat()
    const gz = floor(index.div(side))
    const gx = index.sub(gz.mul(side))
    const base = floor(focus.div(cellSize)).sub(side.mul(0.5))
    const cell = base.add(mod(vec2(gx, gz).sub(base), side)).toVar()
    const seed = cell.x.toInt().add(9000).mul(8192).add(cell.y.toInt().add(9000)).toVar()
    const r0 = hash(seed)
    const r1 = hash(seed.add(0x1234))
    const r2 = hash(seed.add(0x2345))
    const r3 = hash(seed.add(0x3456))
    const xz = cell.add(vec2(r0, r1)).mul(cellSize).toVar()
    const site = texture(field.texture, xz.add(TERRAIN_HALF + 0.5).div(GRID)).level(float(0))
    // Drifts: flowers gather where a mid-scale noise is high.
    const drift = smoothstep(0.5, 0.68, texture(env.noise, xz.div(23)).level(float(0)).g)
    const fromFocus = xz.sub(focus).length().div(side.mul(cellSize).mul(0.5))
    const nearPlayer = smoothstep(shortenRadius.mul(0.6), shortenRadius, xz.sub(player.xz).length())
    const keep = step(r2, drift.mul(0.85).mul(step(0.85, site.b))).mul(smoothstep(1, 0.6, fromFocus)).mul(nearPlayer)
    const size = mix(float(0.06), float(0.1), r3).mul(keep)
    const height = mix(float(0.26), float(0.5), r0).mul(grassHeight)
    const gust = gustAt(env, xz)
    const sway = env.windStrength.mul(gust.mul(0.5).add(0.12)).mul(height).mul(0.55)
    const yaw = r1.mul(6.283)
    const local = positionGeometry.xz.mul(size)
    const turned = vec2(local.x.mul(cos(yaw)).sub(local.y.mul(sin(yaw))), local.x.mul(sin(yaw)).add(local.y.mul(cos(yaw))))
    vKind.assign(r2.div(drift.mul(0.85).max(1e-3)))
    return vec3(
      xz.x.add(turned.x).add(env.windDirection.x.mul(sway)),
      site.r.add(height).add(positionGeometry.y.mul(size)),
      xz.y.add(turned.y).add(env.windDirection.y.mul(sway))
    )
  })()

  const rim = attribute('rim', 'float')
  const petal = mix(color('#f8f4e8'), mix(color('#f4cc44'), color('#a98aea'), step(0.75, vKind)), step(0.5, vKind))
  const colorNode = vec4(mix(color('#f0a93a'), petal, smoothstep(0.15, 0.4, rim)), 1)

  const material = new CelMaterial(env, {
    colorNode,
    positionNode,
    side: DoubleSide,
    outlineColor: null
  })
  material.name = 'flowers'
  const mesh = new Mesh(geometry, material)
  mesh.name = 'flowers'
  mesh.frustumCulled = false
  mesh.receiveShadow = true
  return { mesh }
}

/** A five-petal star in the ground plane, slightly cupped. */
function starGeometry(): InstancedBufferGeometry {
  const positions: number[] = [0, 0.15, 0]
  const rims: number[] = [0]
  const points = 10
  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2
    const r = i % 2 === 0 ? 1 : 0.42
    positions.push(Math.cos(a) * r, i % 2 === 0 ? 0.25 : 0, Math.sin(a) * r)
    rims.push(i % 2 === 0 ? 1 : 0.6)
  }
  const index: number[] = []
  for (let i = 0; i < points; i++) index.push(0, 1 + ((i + 1) % points), 1 + i)
  const normals = new Float32Array(positions.length)
  for (let i = 1; i < normals.length; i += 3) normals[i] = 1
  const geometry = new InstancedBufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  geometry.setAttribute('normal', new BufferAttribute(normals, 3))
  geometry.setAttribute('rim', new BufferAttribute(new Float32Array(rims), 1))
  geometry.setIndex(index)
  return geometry
}
