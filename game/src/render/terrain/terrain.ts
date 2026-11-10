// The ground mesh: 256 m square, one vertex per metre, painted in the shader
// with meadow patches, the worn path and rock on steep slopes.
import { Mesh, PlaneGeometry, type Node } from 'three/webgpu'
import { color, Fn, mix, normalWorld, positionWorld, smoothstep, texture } from 'three/tsl'
import { CelMaterial } from '../materials/cel'
import { trampleAt, type Environment } from '../materials/environment'
import { GRID, type Heightfield, TERRAIN_HALF, TERRAIN_SIZE } from './heightfield'

/**
 * Meadow tones for a patch value in 0..1 (yellower patches high): the bare
 * ground, the grass body and the sunlit tips. Grass roots use the ground tone
 * so blades grow out of the terrain instead of floating on it.
 */
export function meadowTones(patch: Node<'float'>) {
  return {
    ground: mix(color('#3f6e2e'), color('#6b8433'), patch),
    body: mix(color('#5a9238'), color('#8ba23c'), patch),
    tip: mix(color('#a8cc5e'), color('#d6d77c'), patch)
  }
}

/** Patch value at a ground position: large soft areas of yellower and bluer grass. */
export function meadowPatch(low: Node<'float'>, mid: Node<'float'>) {
  return smoothstep(0.3, 0.7, low.add(mid.sub(0.5).mul(0.5)))
}

export function createTerrain(env: Environment, field: Heightfield) {
  const geometry = new PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, GRID - 1, GRID - 1)
  geometry.rotateX(-Math.PI / 2)
  const pos = geometry.attributes.position!
  for (let k = 0; k < pos.count; k++) {
    pos.setY(k, field.heights[k]!)
  }
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()

  const xz = positionWorld.xz
  const fieldUv = xz.add(TERRAIN_HALF + 0.5).div(GRID)
  const sample = texture(field.texture, fieldUv)
  const low = texture(env.noise, xz.div(110)).r
  const mid = texture(env.noise, xz.div(31)).g
  const fine = texture(env.noise, xz.div(5)).b

  const colorNode = Fn(() => {
    const tones = meadowTones(meadowPatch(low, mid))
    // Seen from afar the grass reads as its body colour; up close the ground shows between blades.
    const meadow = mix(tones.ground, tones.body, 0.45).mul(fine.mul(0.16).add(0.92))
    const edgeNoise = fine.sub(0.5).mul(0.5)
    const pathAmount = smoothstep(0.2, 0.6, sample.g.add(edgeNoise))
    const dirt = mix(color('#9a7f58'), color('#c4a97a'), smoothstep(0.55, 0.95, sample.g).mul(fine.mul(0.4).add(0.6)))
    const worn = mix(meadow, color('#7a7446'), smoothstep(0.05, 0.3, sample.g.add(edgeNoise)))
    let ground = mix(worn, dirt, pathAmount)
    // Trampled ground around the player: drier and paler, so the cut grass reads.
    ground = mix(ground, mix(ground, color('#b5ad6a'), 0.55), trampleAt(env, xz).mul(fine.mul(0.4).add(0.6)))
    // Bare rock where the hills get steep.
    const rock = mix(color('#7d7a86'), color('#a29fa6'), mid)
    ground = mix(ground, rock, smoothstep(0.66, 0.82, normalWorld.y.add(fine.sub(0.5).mul(0.08))).oneMinus())
    return ground
  })()

  const material = new CelMaterial(env, {
    colorNode,
    outlineColor: null,
    bandOffset: texture(env.noise, xz.div(7)).b.sub(0.5).mul(0.12)
  })
  material.name = 'terrain'

  const mesh = new Mesh(geometry, material)
  mesh.name = 'terrain'
  mesh.receiveShadow = true
  return { mesh, material }
}
