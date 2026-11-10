// Scattered faceted rocks with moss on their tops: a few big boulders, ruin
// stones around the monolith and pebbles along the path. One merged mesh.
import { IcosahedronGeometry, Matrix4, Mesh, Quaternion, Vector3, Euler, type BufferGeometry } from 'three/webgpu'
import { attribute, color, mix, normalWorld, positionWorld, smoothstep, texture } from 'three/tsl'
import { GeometryBuilder, linearColor } from '../geometry'
import { CelMaterial } from '../materials/cel'
import type { Environment } from '../materials/environment'
import { Noise2D, rng, subSeed } from '../rng'
import { distanceToLine, type Heightfield } from '../terrain/heightfield'
import type { TreeSite } from '../foliage/trees'

const STONE = ['#aaa5b4', '#b4ada6', '#9d99ab', '#bab1a2']

export function createRocks(env: Environment, field: Heightfield, trees: TreeSite[]) {
  const random = rng(subSeed(field.seed, 'rocks'))
  const noise = new Noise2D(subSeed(field.seed, 'rock-shape'))
  const builder = new GeometryBuilder()
  const { player, monolith } = field
  const placed: Array<{ x: number; z: number; r: number }> = []
  const clear = (x: number, z: number, r: number) =>
    Math.abs(x) < 118 &&
    Math.abs(z) < 118 &&
    Math.hypot(x - monolith.x, z - monolith.z) > 6.5 + r &&
    Math.hypot(x - player.x, z - player.z) > 3.5 + r &&
    trees.every(t => Math.hypot(t.x - x, t.z - z) > r + 0.8) &&
    placed.every(p => Math.hypot(p.x - x, p.z - z) > (p.r + r) * 0.9)

  const add = (x: number, z: number, size: number, flat: number) => {
    if (!clear(x, z, size)) return
    placed.push({ x, z, r: size })
    const shape = rockShape(noise, random)
    const scale = new Vector3(size * (1 + random() * 0.5), size * flat, size * (0.8 + random() * 0.4))
    const rot = new Quaternion().setFromEuler(new Euler((random() - 0.5) * 0.3, random() * Math.PI * 2, (random() - 0.5) * 0.3))
    const y = field.heightAt(x, z) - scale.y * 0.3
    const m = new Matrix4().compose(new Vector3(x, y, z), rot, scale)
    const centre = new Vector3(x, y, z)
    builder.add(shape, m, {
      color: linearColor(STONE[Math.floor(random() * STONE.length)]!, 0.9 + random() * 0.2),
      // Faceted for light, but the outline hull follows a smooth normal.
      vertex: p => {
        const d = p.clone().sub(centre).divide(scale).normalize()
        return { hull: [d.x, d.y, d.z] }
      }
    })
  }

  // Ruin stones in a loose ring around the monolith platform.
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + random() * 0.4
    const d = 8.5 + random() * 4
    add(monolith.x + Math.cos(a) * d, monolith.z + Math.sin(a) * d, 0.5 + random() * 0.6, 0.8 + random() * 0.5)
  }
  // A boulder in the player's view, with a smaller companion.
  add(player.x - 4.2, player.z - 4.6, 1.2, 0.75)
  add(player.x - 2.6, player.z - 5.6, 0.45, 0.8)
  // Pebbles along the path edges.
  for (let i = 0; i < field.pathLine.length; i += 7) {
    const p = field.pathLine[i]!
    if (random() < 0.45) continue
    const side = random() < 0.5 ? -1 : 1
    const q = field.pathLine[Math.min(i + 1, field.pathLine.length - 1)]!
    const dx = q.x - p.x
    const dz = q.z - p.z
    const len = Math.hypot(dx, dz) || 1
    const off = 1.9 + random() * 1.2
    add(p.x - (dz / len) * off * side, p.z + (dx / len) * off * side, 0.15 + random() * 0.25, 0.6 + random() * 0.3)
  }
  // Boulders scattered over the meadow, some in small groups.
  for (let i = 0; i < 26; i++) {
    const x = (random() * 2 - 1) * 105
    const z = (random() * 2 - 1) * 105
    if (distanceToLine(field.pathLine, x, z) < 3.5) continue
    const size = 0.5 + random() * random() * 2.2
    add(x, z, size, 0.55 + random() * 0.4)
    if (random() < 0.5) add(x + size * 1.6, z + (random() - 0.5) * size * 2, size * 0.45, 0.7)
  }

  const vertexColor = attribute('color', 'vec3')
  const fine = texture(env.noise, positionWorld.xz.mul(0.35).add(positionWorld.y.mul(0.2))).b
  const moss = smoothstep(0.55, 0.8, normalWorld.y.add(fine.sub(0.5).mul(0.5)))
  const material = new CelMaterial(env, {
    colorNode: mix(vertexColor.mul(fine.mul(0.2).add(0.9)), color('#6d8f3a'), moss),
    flatShading: true,
    outlineNormal: attribute('hull', 'vec3'),
    bandOffset: null
  })
  material.name = 'rock'
  const mesh = new Mesh(builder.build(), material)
  mesh.name = 'rocks'
  mesh.castShadow = true
  mesh.receiveShadow = true
  return { mesh, placed }
}

function rockShape(noise: Noise2D, random: () => number): BufferGeometry {
  const g = new IcosahedronGeometry(1, 1)
  const pos = g.attributes.position!
  const seed = random() * 100
  const v = new Vector3()
  // Displace by direction so shared corners of the non-indexed faces stay welded.
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const d = v.clone().normalize()
    const n = noise.sample(d.x * 1.6 + seed, d.y * 1.6 + d.z * 1.3) * 0.28
    const flatBottom = d.y < -0.3 ? 0.7 : 1
    v.copy(d).multiplyScalar(1 + n)
    v.y *= flatBottom
    pos.setXYZ(i, v.x, v.y, v.z)
  }
  g.computeVertexNormals()
  return g
}
