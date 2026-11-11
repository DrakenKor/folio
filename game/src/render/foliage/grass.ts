// The near and middle grass bands: instanced blades grouped in tufts.
//
// Clumps sit on a fixed world grid of cells around a focus ahead of the
// camera. Each instance maps to the cell congruent to it modulo the grid, so
// moving the camera only recycles clumps leaving one edge into the other, and
// every tuft comes from a hash of its world cell: density and blade size at a
// spot never depend on the camera. Blades thin out and shorten with distance
// over the ground grass, bend with the shared wind, part around the player and
// grow shorter and drier where it fights.
import { BufferAttribute, DoubleSide, InstancedBufferGeometry, Mesh } from 'three/webgpu'
import {
  cameraViewMatrix,
  cos,
  float,
  floor,
  Fn,
  hash,
  instanceIndex,
  mix,
  mod,
  positionGeometry,
  sin,
  smoothstep,
  sqrt,
  step,
  texture,
  uniform,
  vec2,
  vec3,
  vec4,
  varyingProperty
} from 'three/tsl'
import type { Node } from 'three/webgpu'
import { trampleAt, type Environment } from '../materials/environment'
import { windAt } from '../materials/wind'
import { MeadowMaterial } from '../terrain/meadow-material'
import { GRID, type Heightfield, TERRAIN_HALF } from '../terrain/heightfield'
import { bladeTone, dryGrass, meadowTones } from '../terrain/meadow-tones'
import { fieldFocus, nearFade } from './bands'
import { CLUMP_CELL, tuftAt } from './tufts'
/** Clump cells per side of the field: 176 × 0.5 m covers 88 m. */
const CLUMP_SIDE = 176
/** Blades per tuft; 176² × 9 is about 279k blades. */
const BLADES = 9

export function createGrass(env: Environment, field: Heightfield) {
  const geometry = bladeGeometry()
  geometry.instanceCount = CLUMP_SIDE * CLUMP_SIDE * BLADES

  const uniforms = {
    player: env.player,
    height: uniform(1),
    density: uniform(1),
    /** Blades within this radius bend away from the player. */
    bendRadius: uniform(1.2),
    /** Grass within this radius is cut shorter, as where fights happen. */
    shortenRadius: env.trampleRadius
  }

  const vT = varyingProperty('float', 'vGrassT')
  const vGust = varyingProperty('float', 'vGrassGust')
  const vPatch = varyingProperty('float', 'vGrassPatch')
  const vVariety = varyingProperty('float', 'vGrassVariety')
  const vFade = varyingProperty('float', 'vGrassFade')
  const vTrample = varyingProperty('float', 'vGrassTrample')
  const vNormal = varyingProperty('vec3', 'vGrassNormal')

  const side = float(CLUMP_SIDE)
  const fieldAt = (p: Node<'vec2'>) => texture(field.texture, p.add(TERRAIN_HALF + 0.5).div(GRID)).level(float(0))

  const positionNode = Fn(() => {
    const index = instanceIndex.toFloat()
    const clump = floor(index.div(BLADES))
    const blade = index.sub(clump.mul(BLADES))
    const gz = floor(clump.div(side))
    const gx = clump.sub(gz.mul(side))
    const focus = fieldFocus(CLUMP_SIDE * CLUMP_CELL * 0.5 - 10).toVar()
    const base = floor(focus.div(CLUMP_CELL)).sub(side.mul(0.5))
    const cell = base.add(mod(vec2(gx, gz).sub(base), side)).toVar()
    const tuft = tuftAt(env, cell)
    const bladeSeed = tuft.seed.mul(BLADES).add(blade.toInt()).toVar()
    const clumpRand = tuft.rand
    const bladeRand = (salt: number) => hash(bladeSeed.add(salt))

    // The tuft: a jittered centre, a radius, a height and a hue of its own.
    const { centre, radius } = tuft
    const tuftHeight = tuft.height
    const tuftHue = clumpRand(0x3b9d).sub(0.5).mul(0.32)

    // The blade: spread over the tuft's disc, leaning out from its centre.
    const r = sqrt(bladeRand(0x1234))
    const angle = bladeRand(0x2345).mul(6.283)
    const out = vec2(cos(angle), sin(angle))
    const xz = centre.add(out.mul(r.mul(radius))).toVar()
    const site = fieldAt(xz).toVar()
    const groundY = site.r

    // Path edges thin tuft by tuft; the middle band thins and shortens with distance.
    const mask = site.b
    const edge = xz.sub(focus).abs()
    const fade = nearFade(vec3(xz.x, groundY, xz.y))
      .mul(smoothstep(34, 42, edge.x.max(edge.y)).oneMinus()).toVar()
    const keep = step(clumpRand(0x4567), mask.mul(1.15)).mul(step(clumpRand(0x6d2b), uniforms.density))
    const trample = trampleAt(env, xz).toVar()
    const height = mix(float(0.42), float(0.9), bladeRand(0x5678).pow(1.5))
      .mul(tuftHeight)
      .mul(r.mul(0.35).oneMinus())
      .mul(uniforms.height)
      .mul(keep)
      .mul(mask.mul(0.5).add(0.5))
      .mul(mix(float(1), float(0.36), trample))
      .mul(fade).toVar()
    const width = mix(float(0.055), float(0.085), bladeRand(0x6789)).mul(fade.mul(0.7).add(0.3)).mul(trample.mul(0.4).oneMinus())

    // Bend: the tuft's splay, the shared wind with a little flutter, and the player's push.
    const wind = windAt(env, xz)
    const flutter = sin(env.time.mul(3.1).add(angle).sub(xz.dot(env.windDirection).mul(0.6))).mul(0.1)
    const toPlayer = xz.sub(uniforms.player.xz)
    const playerDist = toPlayer.length().max(1e-3)
    const bendRadius = uniforms.bendRadius.max(1e-4)
    const push = smoothstep(bendRadius.mul(0.15), bendRadius, playerDist).oneMinus().mul(step(1e-4, uniforms.bendRadius)).mul(1.1)
    const bend = out
      .mul(r.mul(0.45).add(0.1)).mul(tuft.lean)
      .add(env.windDirection.mul(wind.lean.add(flutter)))
      .add(toPlayer.div(playerDist).mul(push))
    const amount = bend.length().max(1e-4)
    const bendDir = bend.div(amount)
    const lean = amount.min(1.3)

    const t = positionGeometry.y
    const horizontal = height.mul(t).mul(t).mul(lean).mul(0.62)
    const vertical = height.mul(t).mul(float(1).sub(lean.mul(lean).mul(t).mul(t).mul(0.28)))
    // The blade's face turns towards its splay, with some jitter.
    const yaw = angle.add(1.5708).add(bladeRand(0x789a).sub(0.5).mul(0.9))
    const across = vec2(cos(yaw), sin(yaw))
    const offset = positionGeometry.x.mul(width).mul(t.mul(0.75).oneMinus())

    // Lit like the ground under it: the slope's normal, tipped a little by the blade.
    const slope = vec3(fieldAt(xz.sub(vec2(9, 0))).r.sub(fieldAt(xz.add(vec2(9, 0))).r), 18, fieldAt(xz.sub(vec2(0, 9))).r.sub(fieldAt(xz.add(vec2(0, 9))).r)).normalize()
    vNormal.assign(vec3(slope.x.mul(1.8), slope.y, slope.z.mul(1.8)).normalize().add(vec3(bendDir.x, 0, bendDir.y).mul(t.mul(0.2).mul(fade))).add(vec3(across.y.negate(), 0, across.x).mul(fade.mul(0.12))).normalize())
    vT.assign(t)
    vFade.assign(fade)
    vGust.assign(wind.gust)
    vPatch.assign(tuft.patch.add(tuftHue.mul(fade)))
    vVariety.assign(clumpRand(0x1f3d))
    vTrample.assign(trample)

    return vec3(
      xz.x.add(across.x.mul(offset)).add(bendDir.x.mul(horizontal)),
      groundY.add(vertical).sub(0.03),
      xz.y.add(across.y.mul(offset)).add(bendDir.y.mul(horizontal))
    )
  })()

  const colorNode = Fn(() => {
    const tones = meadowTones(vPatch.clamp(0, 1))
    let c = mix(tones.ground, bladeTone(tones, vT), vFade)
    c = c.mul(vVariety.sub(0.5).mul(0.06).mul(vFade).add(1))
    c = dryGrass(c, vTrample)
    return vec4(c, 1)
  })()

  const material = new MeadowMaterial(env, {
    colorNode,
    positionNode,
    normalNode: cameraViewMatrix.mul(vec4(vNormal, 0)).xyz.normalize(),
    side: DoubleSide,
    outlineColor: null
  }, vGust.mul(vT.mul(0.65).add(0.35)).mul(vTrample.mul(0.75).oneMinus()))
  material.name = 'grass'

  const mesh = new Mesh(geometry, material)
  mesh.name = 'grass'
  mesh.frustumCulled = false
  mesh.receiveShadow = true
  mesh.castShadow = false

  return {
    mesh,
    material,
    uniforms,
    setPlayer(x: number, z: number) {
      uniforms.player.value.set(x, field.heightAt(x, z), z)
    }
  }
}

/** One blade: x in [-0.5, 0.5] across, y in [0, 1] up; the taper comes from the shader. */
function bladeGeometry(): InstancedBufferGeometry {
  const rows = [0, 0.3, 0.55, 0.78]
  const positions: number[] = []
  for (const y of rows) positions.push(-0.5, y, 0, 0.5, y, 0)
  positions.push(0, 1, 0)
  const index: number[] = []
  for (let r = 0; r < rows.length - 1; r++) {
    const a = r * 2
    index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
  }
  const last = (rows.length - 1) * 2
  index.push(last, last + 1, last + 2)
  const geometry = new InstancedBufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  const normals = new Float32Array(positions.length)
  for (let i = 2; i < normals.length; i += 3) normals[i] = 1
  geometry.setAttribute('normal', new BufferAttribute(normals, 3))
  geometry.setIndex(index)
  return geometry
}
