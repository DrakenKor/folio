// The ground mesh: 256 m square, one vertex per metre, painted in the shader
// with ground grass that shows the travelling gusts, the worn path and rock on
// steep slopes.
import { Mesh, PlaneGeometry } from 'three/webgpu'
import { color, Fn, mix, normalWorld, positionWorld, smoothstep, texture } from 'three/tsl'
import { CelMaterial } from '../materials/cel'
import { trampleAt, triplanarNoise, type Environment } from '../materials/environment'
import { gustAt } from '../materials/wind'
import { nearFade } from '../foliage/bands'
import { GRID, type Heightfield, TERRAIN_HALF, TERRAIN_SIZE } from './heightfield'
import { dryGrass, groundGrass, meadowPatch } from './meadow-tones'

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
  const fine = texture(env.noise, xz.div(5)).b

  const colorNode = Fn(() => {
    const trample = trampleAt(env, xz).toVar()
    // Where full blades stand: the near band, off the path, outside the trampled ring.
    const near = nearFade(positionWorld).mul(sample.b).mul(trample.mul(0.6).oneMinus())
    // Ground-plane detail would stretch down steep slopes, so it calms there as in the trampled ring.
    const calm = trample.max(smoothstep(0.78, 0.95, normalWorld.y).oneMinus())
    const meadow = dryGrass(groundGrass(env, xz, meadowPatch(env, xz), gustAt(env, xz), near, calm), trample.mul(fine.mul(0.4).add(0.6)))
    // The path: soft edges broken in half-metre bites where the ground grass thins into worn earth.
    const edgeNoise = texture(env.noise, xz.div(9)).g.sub(0.5).mul(0.4).add(fine.sub(0.5).mul(0.1))
    const pathAmount = smoothstep(0.22, 0.62, sample.g.add(edgeNoise))
    const dirt = mix(color('#967d59'), color('#b39b74'), smoothstep(0.55, 0.95, sample.g).mul(fine.mul(0.4).add(0.6)))
    let ground = mix(meadow, dirt, pathAmount)
    // Bare rock where the hills get steep, its noise projected along the slope so it never stretches.
    const rockNoise = triplanarNoise(env, positionWorld, normalWorld, 1 / 31)
    const rock = mix(color('#7a746b'), color('#948c81'), rockNoise)
    ground = mix(ground, rock, smoothstep(0.66, 0.82, normalWorld.y.add(rockNoise.sub(0.5).mul(0.08))).oneMinus())
    return ground
  })()

  const material = new CelMaterial(env, {
    colorNode,
    outlineColor: null,
    bandOffset: triplanarNoise(env, positionWorld, normalWorld, 1 / 7).sub(0.5).mul(0.12)
  })
  material.name = 'terrain'

  const mesh = new Mesh(geometry, material)
  mesh.name = 'terrain'
  mesh.receiveShadow = true
  return { mesh, material }
}
