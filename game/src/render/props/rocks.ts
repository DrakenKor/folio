// Warm chamfered boulders and ruin stones, with moss confined to upward planes.
import { Matrix4, Mesh, Quaternion, Vector3, Euler } from 'three/webgpu'
import { attribute, color, float, mix } from 'three/tsl'
import { GeometryBuilder, linearColor } from '../geometry'
import { CelMaterial } from '../materials/cel'
import type { Environment } from '../materials/environment'
import { rng, subSeed } from '../rng'
import { distanceToLine, type Heightfield } from '../terrain/heightfield'
import type { TreeSite } from '../foliage/trees'
import { stoneGeometry } from './stone-geometry'
import { stoneMoss } from './stone-moss'

/** Warm greys at mid value, clearly below the knight's armour. */
const STONE = ['#8a8880', '#807e78', '#918d82', '#7f817a']

export function createRocks(env: Environment, field: Heightfield, trees: TreeSite[]) {
  const random = rng(subSeed(field.seed, 'rocks'))
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
    const shape = stoneGeometry(random)
    const scale = new Vector3(size * (1 + random() * 0.5), size * flat, size * (0.8 + random() * 0.4))
    const rot = new Quaternion().setFromEuler(new Euler((random() - 0.5) * 0.3, random() * Math.PI * 2, (random() - 0.5) * 0.3))
    const y = field.heightAt(x, z) - scale.y * 0.16
    const m = new Matrix4().compose(new Vector3(x, y, z), rot, scale)
    if (field.arena && Math.hypot(x - field.arena.center.x, z - field.arena.center.z) < field.arena.radius + size * 1.7) {
      shape.dispose()
      return
    }
    const centre = new Vector3(x, y, z)
    builder.add(shape, m, {
      color: linearColor(STONE[Math.floor(random() * STONE.length)]!, 0.9 + random() * 0.2),
      // The ink hull stays continuous across the broad planes and bevels.
      vertex: p => {
        const d = p.clone().sub(centre).divide(scale).normalize()
        return { hull: [d.x, d.y, d.z] }
      }
    })
    shape.dispose()
  }

  // Ruin stones in a loose ring around the monolith platform.
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + random() * 0.4
    const d = 8.5 + random() * 4
    add(monolith.x + Math.cos(a) * d, monolith.z + Math.sin(a) * d, 0.5 + random() * 0.6, 0.8 + random() * 0.5)
  }
  // A boulder in the player's view, with a smaller companion.
  add(player.x - 4.2, player.z - 4.6, 1.45, 0.95)
  add(player.x - 2.6, player.z - 5.6, 0.45, 0.8)
  // Boulders scattered over the meadow, some in small groups.
  for (let i = 0; i < 16; i++) {
    const x = (random() * 2 - 1) * 105
    const z = (random() * 2 - 1) * 105
    if (distanceToLine(field.pathLine, x, z) < 3.5) continue
    const size = 0.9 + random() * random() * 1.8
    add(x, z, size, 0.55 + random() * 0.4)
    if (random() < 0.25) add(x + size * 1.6, z + (random() - 0.5) * size * 2, size * 0.45, 0.7)
  }

  const vertexColor = attribute('color', 'vec3')
  const moss = stoneMoss(float(0)).mul(0.72)
  const material = new CelMaterial(env, {
    colorNode: mix(vertexColor, color('#506d43'), moss),
    outlineNormal: attribute('hull', 'vec3'),
    outlineWidth: 0.8,
    bandOffset: null
  })
  material.name = 'rock'
  const mesh = new Mesh(builder.build(), material)
  mesh.name = 'rocks'
  mesh.castShadow = true
  mesh.receiveShadow = true
  return { mesh, placed }
}
