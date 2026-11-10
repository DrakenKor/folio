// Wildflowers in deliberate drifts: a few elongated clusters through the near
// grass, each mostly one colour, nodding to the shared wind and thinning out
// with the near band. Clusters sit on a coarse world grid around the same
// camera focus as the grass, so they never swim or depend on the camera.
import { BufferAttribute, DoubleSide, InstancedBufferGeometry, Mesh } from 'three/webgpu'
import { attribute, color, cos, float, floor, Fn, hash, instanceIndex, mix, mod, positionGeometry, sin, smoothstep, step, texture, vec2, vec3, vec4, varyingProperty } from 'three/tsl'
import { CelMaterial } from '../materials/cel'
import { trampleAt, type Environment } from '../materials/environment'
import { windAt } from '../materials/wind'
import { GRID, type Heightfield, TERRAIN_HALF } from '../terrain/heightfield'
import { fieldFocus, nearFade } from './bands'

/** Metres per cluster cell. */
const CELL = 5
/** Cluster cells per side: 13 × 5 m covers the near and middle bands ahead of the camera. */
const SIDE = 13
/** Flowers per cluster. */
const PER_CLUSTER = 22
/** Share of cells that hold a drift where the meadow allows one. */
const CLUSTER_CHANCE = 0.3

export function createFlowers(env: Environment, field: Heightfield) {
  const geometry = starGeometry()
  geometry.instanceCount = SIDE * SIDE * PER_CLUSTER
  const vKind = varyingProperty('float', 'vFlowerKind')
  const side = float(SIDE)

  const positionNode = Fn(() => {
    const index = instanceIndex.toFloat()
    const cluster = floor(index.div(PER_CLUSTER))
    const flower = index.sub(cluster.mul(PER_CLUSTER))
    const gz = floor(cluster.div(side))
    const gx = cluster.sub(gz.mul(side))
    const base = floor(fieldFocus(SIDE * CELL * 0.5 - 6).div(CELL)).sub(side.mul(0.5))
    const cell = base.add(mod(vec2(gx, gz).sub(base), side)).toVar()
    const clusterSeed = cell.x.toInt().add(9000).mul(8192).add(cell.y.toInt().add(9000)).toVar()
    const seed = clusterSeed.mul(PER_CLUSTER).add(flower.toInt()).toVar()
    const clusterRand = (salt: number) => hash(clusterSeed.add(salt))
    const rand = (salt: number) => hash(seed.add(salt))

    // The drift: an ellipse with a heading, denser at its heart.
    const centre = cell.add(vec2(clusterRand(0x1234), clusterRand(0x2345)).mul(0.6).add(0.2)).mul(CELL)
    const heading = clusterRand(0x3456).mul(3.1416)
    const length = mix(float(1.2), float(2.4), clusterRand(0x4567))
    const spread = rand(0x5678).pow(1.4)
    const turn = rand(0x6789).mul(6.283)
    const local = vec2(cos(turn).mul(length), sin(turn).mul(length.mul(0.4))).mul(spread)
    const xz = centre.add(vec2(local.x.mul(cos(heading)).sub(local.y.mul(sin(heading))), local.x.mul(sin(heading)).add(local.y.mul(cos(heading))))).toVar()
    const site = texture(field.texture, xz.add(TERRAIN_HALF + 0.5).div(GRID)).level(float(0))
    const centreSite = texture(field.texture, centre.add(TERRAIN_HALF + 0.5).div(GRID)).level(float(0))

    const fade = nearFade(vec3(xz.x, site.r, xz.y))
    const threshold = rand(0x789a).mul(0.85)
    const exists = step(clusterRand(0x89ab), float(CLUSTER_CHANCE)).mul(step(0.9, centreSite.b)).mul(step(0.9, site.b))
    const keep = exists.mul(smoothstep(threshold, threshold.add(0.15), fade)).mul(trampleAt(env, xz).oneMinus())
    const size = mix(float(0.032), float(0.05), rand(0x9abc)).mul(keep)
    const height = mix(float(0.16), float(0.3), rand(0xabcd))
    const lean = windAt(env, xz).lean.add(sin(env.time.mul(2.3).add(turn)).mul(0.05)).mul(height).mul(0.6)
    const yaw = rand(0xbcde).mul(6.283)
    const petal = positionGeometry.xz.mul(size)
    const turned = vec2(petal.x.mul(cos(yaw)).sub(petal.y.mul(sin(yaw))), petal.x.mul(sin(yaw)).add(petal.y.mul(cos(yaw))))
    // Kind: the drift's own colour, with an odd flower of another colour.
    const own = clusterRand(0xcdef)
    vKind.assign(mix(own, rand(0xdef0), step(0.86, rand(0xef01))))
    return vec3(
      xz.x.add(turned.x).add(env.windDirection.x.mul(lean)),
      site.r.add(height).add(positionGeometry.y.mul(size)),
      xz.y.add(turned.y).add(env.windDirection.y.mul(lean))
    )
  })()

  const rim = attribute('rim', 'float')
  const cream = color('#f1e8cf')
  const yellow = color('#ecd27a')
  const lilac = color('#b6a5d6')
  const petal = mix(mix(cream, yellow, step(0.48, vKind)), lilac, step(0.85, vKind))
  const colorNode = vec4(mix(color('#d9a948'), petal, smoothstep(0.15, 0.4, rim)), 1)

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
    const r = i % 2 === 0 ? 1 : 0.55
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
