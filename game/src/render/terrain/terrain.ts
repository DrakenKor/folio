// The ground mesh: 256 m square, one vertex per metre, painted in the shader
// with ground grass that shows the travelling gusts, the worn path and rock on
// steep slopes.
import { Mesh, PlaneGeometry } from 'three/webgpu'
import { cameraViewMatrix, color, dot, Fn, mix, normalWorldGeometry, positionWorld, smoothstep, texture, vec3, vec4 } from 'three/tsl'
import { trampleAt, triplanarNoise, type Environment } from '../materials/environment'
import { gustAt } from '../materials/wind'
import { createGrassPaint } from '../foliage/paint'
import { MeadowMaterial } from './meadow-material'
import { GRID, type Heightfield, TERRAIN_HALF, TERRAIN_SIZE } from './heightfield'
import { dryGrass, groundGrass, meadowPatch, meadowTones } from './meadow-tones'

export function createTerrain(env: Environment, field: Heightfield) {
  const geometry = new PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, GRID - 1, GRID - 1)
  geometry.rotateX(-Math.PI / 2)
  const pos = geometry.attributes.position!
  for (let k = 0; k < pos.count; k++) {
    pos.setY(k, field.heights[k]!)
  }
  // Broad slope normals keep hill lighting in calm bands while preserving ground contact.
  const normals = geometry.attributes.normal!
  for (let k = 0; k < pos.count; k++) {
    const x = pos.getX(k)
    const z = pos.getZ(k)
    const nx = field.heightAt(x - 9, z) - field.heightAt(x + 9, z)
    const nz = field.heightAt(x, z - 9) - field.heightAt(x, z + 9)
    const length = Math.hypot(nx, 18, nz)
    normals.setXYZ(k, nx / length, 18 / length, nz / length)
  }
  geometry.computeBoundingSphere()

  const paint = createGrassPaint(env.seed)
  const xz = positionWorld.xz
  const fieldUv = xz.add(TERRAIN_HALF + 0.5).div(GRID)
  const sample = texture(field.texture, fieldUv)
  const fine = texture(env.noise, xz.div(5)).b
  const edgeNoise = texture(env.noise, xz.div(9)).g.sub(0.5).mul(0.4).add(fine.sub(0.5).mul(0.1))
  const pathAmount = smoothstep(0.22, 0.62, sample.g.add(edgeNoise))
  const rockNoise = triplanarNoise(env, positionWorld, normalWorldGeometry, 1 / 31)
  const rockAmount = smoothstep(0.66, 0.82, normalWorldGeometry.y.add(rockNoise.sub(0.5).mul(0.08))).oneMinus()

  const colorNode = Fn(() => {
    const trample = trampleAt(env, xz).toVar()
    // Ground-plane detail would stretch down steep slopes, so it calms there as in the trampled ring.
    const calm = trample.max(smoothstep(0.78, 0.95, normalWorldGeometry.y).oneMinus())
    const patch = meadowPatch(env, xz).toVar()
    const meadow = dryGrass(groundGrass(env, paint, xz, patch, calm), trample.mul(fine.mul(0.4).add(0.6)))
    // The path: soft edges broken in half-metre bites where the ground grass thins into worn earth.
    const earth = mix(color('#867653'), color('#a18d68'), fine)
    const luma = vec3(0.2126, 0.7152, 0.0722)
    const dirt = earth.mul(dot(meadowTones(patch).ground, luma).div(dot(earth, luma)))
    let ground = mix(meadow, dirt, pathAmount)
    // Bare rock where the hills get steep, its noise projected along the slope so it never stretches.
    const rock = mix(color('#7a746b'), color('#948c81'), rockNoise)
    ground = mix(ground, rock, rockAmount)
    return ground
  })()

  const sheen = gustAt(env, xz).mul(smoothstep(0.05, 0.7, sample.b))
    .mul(pathAmount.oneMinus()).mul(rockAmount.oneMinus())
    .mul(trampleAt(env, xz).mul(0.75).oneMinus())
  const material = new MeadowMaterial(env, {
    colorNode,
    normalNode: cameraViewMatrix.mul(vec4(vec3(normalWorldGeometry.x.mul(1.8), normalWorldGeometry.y, normalWorldGeometry.z.mul(1.8)).normalize(), 0)).xyz,
    outlineColor: null
  }, sheen)
  material.name = 'terrain'

  const mesh = new Mesh(geometry, material)
  mesh.name = 'terrain'
  mesh.receiveShadow = true
  return { mesh, material }
}
