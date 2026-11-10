// Dense instanced grass that follows a focus point.
//
// Blades sit on a world-aligned grid of cells around the focus. Each instance
// maps to the cell congruent to it modulo the grid, so moving the focus only
// recycles the blades leaving one edge into the other: every blade's shape
// comes from a hash of its world cell, and the field never swims. Heights and
// masks come from the heightfield texture; wind from scrolling noise; blades
// bend away from the player and shorten around them.
import { BufferAttribute, InstancedBufferGeometry, Mesh, Vector2, Vector3, DoubleSide } from 'three/webgpu'
import {
  cameraViewMatrix,
  color,
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
  step,
  texture,
  uniform,
  vec2,
  vec3,
  vec4,
  varyingProperty
} from 'three/tsl'
import { CelMaterial } from '../materials/cel'
import type { Environment } from '../materials/environment'
import { GRID, type Heightfield, TERRAIN_HALF } from '../terrain/heightfield'
import { meadowPatch, meadowTones } from '../terrain/terrain'
import { gustAt } from '../materials/wind'

/** Instances per side of the grid: 384² is about 147k blades. */
export const GRASS_SIDE = 384
/** Metres per cell at full density; wide views use larger cells. */
export const GRASS_CELL = 0.2

export function createGrass(env: Environment, field: Heightfield) {
  const geometry = bladeGeometry()
  geometry.instanceCount = GRASS_SIDE * GRASS_SIDE

  const uniforms = {
    focus: uniform(new Vector2(field.player.x, field.player.z)),
    player: uniform(new Vector3(field.player.x, field.heightAt(field.player.x, field.player.z), field.player.z)),
    /** Metres per grid cell. Larger cells spread the same blades wider, each one broader. */
    cell: uniform(GRASS_CELL),
    height: uniform(1),
    density: uniform(1),
    /** Blades within this radius bend away from the player. */
    bendRadius: uniform(1.4),
    /** Grass within this radius is cut shorter, as where fights happen. */
    shortenRadius: uniform(3.2)
  }

  const vT = varyingProperty('float', 'vGrassT')
  const vGust = varyingProperty('float', 'vGrassGust')
  const vPatch = varyingProperty('float', 'vGrassPatch')
  const vVariety = varyingProperty('float', 'vGrassVariety')
  const vNormal = varyingProperty('vec3', 'vGrassNormal')

  const side = float(GRASS_SIDE)
  const half = side.mul(uniforms.cell).mul(0.5)

  const positionNode = Fn(() => {
    const index = instanceIndex.toFloat()
    const gz = floor(index.div(side))
    const gx = index.sub(gz.mul(side))
    const base = floor(uniforms.focus.div(uniforms.cell)).sub(side.mul(0.5))
    const cell = base.add(mod(vec2(gx, gz).sub(base), side)).toVar()
    const seed = cell.x.toInt().add(4096).mul(8192).add(cell.y.toInt().add(4096)).toVar()
    const r0 = hash(seed)
    const r1 = hash(seed.add(0x9e37))
    const r2 = hash(seed.add(0x51ed))
    const r3 = hash(seed.add(0x2c1b))
    const r4 = hash(seed.add(0x7f4a))
    const r5 = hash(seed.add(0x3b9d))

    const xz = cell.add(vec2(r0, r1)).mul(uniforms.cell).toVar()
    const site = texture(field.texture, xz.add(TERRAIN_HALF + 0.5).div(GRID)).level(float(0))
    const groundY = site.r

    // Fade at the edge of the field, thin out along the path, cut near the player.
    const fromFocus = xz.sub(uniforms.focus).length().div(half)
    const edge = smoothstep(1.0, 0.55, fromFocus)
    const mask = site.b
    const keep = step(r5, mask.mul(1.15)).mul(step(r4, uniforms.density))
    const toPlayer = xz.sub(uniforms.player.xz)
    const playerDist = toPlayer.length().max(1e-3)
    const shorten = mix(float(0.4), float(1), smoothstep(uniforms.shortenRadius.mul(0.45), uniforms.shortenRadius, playerDist))
    const tall = r3.mul(r3)
    const height = mix(float(0.32), float(0.82), tall).mul(uniforms.height).mul(edge).mul(keep).mul(shorten).mul(mask.mul(0.6).add(0.4))
    const width = mix(float(0.055), float(0.095), r4).mul(uniforms.cell.div(GRASS_CELL))

    // Wind: big scrolling gusts plus a little per-blade flutter.
    const gust = gustAt(env, xz).toVar()
    const flutter = sin(env.time.mul(2.6).add(r2.mul(6.283)).add(xz.x.mul(0.35)))
    const windAmount = env.windStrength.mul(gust.mul(0.95).add(0.22)).add(flutter.mul(0.07))

    const yaw = r2.mul(6.283)
    const leanDir = vec2(cos(yaw.add(1.3)), sin(yaw.add(1.3)))
    const push = smoothstep(uniforms.bendRadius, uniforms.bendRadius.mul(0.15), playerDist).mul(1.5)
    const bend = leanDir.mul(r4.mul(0.25).add(0.12)).add(env.windDirection.mul(windAmount)).add(toPlayer.div(playerDist).mul(push))
    const amount = bend.length().max(1e-4)
    const bendDir = bend.div(amount)
    const angle = amount.min(1.35)

    const t = positionGeometry.y
    const horizontal = height.mul(t).mul(t).mul(angle).mul(0.62)
    const vertical = height.mul(t).mul(float(1).sub(angle.mul(angle).mul(t).mul(t).mul(0.28)))
    const across = vec2(cos(yaw), sin(yaw))
    const offset = positionGeometry.x.mul(width)

    vT.assign(t)
    vGust.assign(gust)
    vPatch.assign(meadowPatch(texture(env.noise, xz.div(110)).level(float(0)).r, texture(env.noise, xz.div(31)).level(float(0)).g))
    vVariety.assign(r5)
    const facing = vec3(across.y.negate(), 0, across.x)
    vNormal.assign(vec3(bendDir.x.mul(0.25), 1, bendDir.y.mul(0.25)).add(facing.mul(0.3)).normalize())

    return vec3(
      xz.x.add(across.x.mul(offset)).add(bendDir.x.mul(horizontal)),
      groundY.add(vertical).sub(0.04),
      xz.y.add(across.y.mul(offset)).add(bendDir.y.mul(horizontal))
    )
  })()

  const colorNode = Fn(() => {
    const t = vT
    const tones = meadowTones(vPatch)
    let c = mix(tones.ground.mul(0.82), tones.body, smoothstep(0, 0.55, t))
    c = mix(c, tones.tip, smoothstep(0.5, 1, t))
    c = c.mul(vVariety.mul(0.12).add(0.94))
    // Gusts catch the light on the tips: visible waves rolling across the field.
    c = mix(c, color('#e6e9a6'), vGust.mul(t).mul(t).mul(0.38))
    return vec4(c, 1)
  })()

  const material = new CelMaterial(env, {
    colorNode,
    positionNode,
    normalNode: cameraViewMatrix.mul(vec4(vNormal, 0)).xyz.normalize(),
    side: DoubleSide,
    outlineColor: null
  })
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
    /** Recentres the field; blades are stable in world space. */
    setFocus(x: number, z: number) {
      uniforms.focus.value.set(x, z)
    },
    setPlayer(x: number, z: number) {
      uniforms.player.value.set(x, field.heightAt(x, z), z)
    }
  }
}

/** One tapered blade: x in [-0.5, 0.5] across, y in [0, 1] up. */
function bladeGeometry(): InstancedBufferGeometry {
  const rows: Array<[number, number]> = [
    [0, 0.5],
    [0.4, 0.42],
    [0.75, 0.26]
  ]
  const positions: number[] = []
  for (const [y, w] of rows) positions.push(-w, y, 0, w, y, 0)
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
