// Sky dome with a painted gradient, a sun and drifting two-tone clouds, plus
// two rings of far hills that the haze turns progressively blue.
import { BackSide, BufferAttribute, BufferGeometry, Group, Mesh, MeshBasicNodeMaterial, SphereGeometry, type Camera } from 'three/webgpu'
import { cameraPosition, color, float, Fn, mix, mrt, normalize, positionWorld, smoothstep, vec4 } from 'three/tsl'
import { CelMaterial } from '../materials/cel'
import { cloudDensity, type Environment } from '../materials/environment'
import { Noise2D, subSeed } from '../rng'

const SKY_RADIUS = 1800

export function createSky(env: Environment) {
  const group = new Group()
  group.name = 'sky'

  const dir = normalize(positionWorld.sub(cameraPosition))
  const up = dir.y
  const sunDot = dir.dot(env.sunDirection).max(0)

  // Project the view ray onto a flat cloud layer.
  const toLayer = dir.xz.mul(float(300).sub(cameraPosition.y).div(up.max(0.03)))
  const cloudUv = cameraPosition.xz.add(toLayer).mul(0.0011).sub(env.windDirection.mul(env.time.mul(0.0022)))
  const body = cloudDensity(env, cloudUv)
  const towardSun = cloudDensity(env, cloudUv.add(env.sunDirection.xz.normalize().mul(0.05)))
  const cover = smoothstep(env.cloudCover.sub(0.01), env.cloudCover.add(0.045), body).mul(smoothstep(0.01, 0.16, up))
  const disk = smoothstep(0.99955, 0.99975, sunDot).mul(cover.oneMinus())

  const colorNode = Fn(() => {
    const gradient = smoothstep(-0.02, 0.7, up).pow(0.7)
    let sky = mix(env.horizon, env.zenith, gradient)
    sky = sky.add(env.sunHaze.mul(sunDot.pow(12).mul(0.5)))
    const coverage = env.cloudCover
    // Soft painted edges and warm tops over lavender undersides.
    const shaded = smoothstep(-0.006, 0.018, towardSun.sub(body)).mul(0.85)
      .add(smoothstep(coverage, coverage.add(0.18), body).mul(0.15))
    const lit = mix(color('#fff2da'), env.sunHaze, sunDot.pow(3).mul(0.45))
    const under = mix(color('#9296c2'), color('#b3b1d1'), smoothstep(coverage.add(0.05), coverage.add(0.2), body))
    const cloud = mix(lit, under, shaded)
    // Clouds near the horizon sink into the haze.
    const cloudFinal = mix(env.horizon, cloud, smoothstep(0.0, 0.25, up).mul(0.7).add(0.3))
    sky = mix(sky, cloudFinal, cover)
    sky = mix(env.haze, sky, smoothstep(-0.06, 0.02, up))
    return vec4(sky.add(env.sunColor.mul(disk).mul(0.5)), 1)
  })()

  const material = new MeshBasicNodeMaterial({ side: BackSide, depthWrite: false })
  material.colorNode = colorNode
  material.mrtNode = mrt({ glow: vec4(env.sunColor.mul(disk).mul(0.35), 1) })
  material.fog = false
  material.name = 'sky'
  const dome = new Mesh(new SphereGeometry(SKY_RADIUS, 48, 24), material)
  dome.name = 'sky-dome'
  dome.renderOrder = -10
  dome.frustumCulled = false
  group.add(dome)

  group.add(createRange(env, { radius: 236, depth: 70, base: -12, low: 26, high: 72, rock: '#657e9e', snowLine: Infinity, shift: 0 }))
  group.add(createRange(env, { radius: 900, depth: 200, base: -60, low: 70, high: 210, rock: '#7682a0', snowLine: 0.6, shift: 31 }))

  return {
    group,
    material,
    /** Keeps the dome centred on the camera. */
    update(camera: Camera) {
      dome.position.copy(camera.position)
    }
  }
}

interface Range {
  radius: number
  depth: number
  base: number
  low: number
  high: number
  rock: string
  /** Fraction of the range's top height above which snow lies; Infinity for none. */
  snowLine: number
  shift: number
}

function createRange(env: Environment, range: Range): Mesh {
  const noise = new Noise2D(subSeed(env.seed, `range-${range.shift}`))
  const segments = 360
  const rows = 8
  const positions = new Float32Array((segments + 1) * (rows + 1) * 3)
  const index: number[] = []
  for (let s = 0; s <= segments; s++) {
    const a = (s / segments) * Math.PI * 2
    const cx = Math.cos(a)
    const cz = Math.sin(a)
    const ridge = 1 - Math.abs(noise.fbm(cx * 2.6 + range.shift, cz * 2.6, 3))
    const broad = noise.fbm(cx * 1.1 - range.shift, cz * 1.1, 2) * 0.5 + 0.5
    const peak = range.low + (range.high - range.low) * Math.pow(ridge, 2.4) * (0.4 + broad * 0.8)
    for (let r = 0; r <= rows; r++) {
      const f = r / rows
      const y = range.base + (peak - range.base) * Math.pow(f, 0.8)
      const wobble = noise.sample(cx * 4 + range.shift, cz * 4) * range.depth * 0.12 * (1 - f)
      const radius = range.radius - (1 - f) * range.depth + wobble
      const k = (s * (rows + 1) + r) * 3
      positions[k] = cx * radius
      positions[k + 1] = y
      positions[k + 2] = cz * radius
    }
  }
  for (let s = 0; s < segments; s++) {
    for (let r = 0; r < rows; r++) {
      const a = s * (rows + 1) + r
      const b = a + rows + 1
      index.push(a, b, a + 1, b, b + 1, a + 1)
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setIndex(index)
  geometry.computeVertexNormals()

  const colorNode = Fn(() => {
    const rock = color(range.rock)
    if (!Number.isFinite(range.snowLine)) return rock
    const height = positionWorld.y.div(range.high)
    const snow = smoothstep(float(range.snowLine), float(range.snowLine + 0.06), height)
    return mix(rock, color('#f2f5fa'), snow)
  })()
  const material = new CelMaterial(env, { colorNode, outlineColor: null })
  material.name = 'range'
  const mesh = new Mesh(geometry, material)
  mesh.name = 'range'
  mesh.frustumCulled = false
  return mesh
}
