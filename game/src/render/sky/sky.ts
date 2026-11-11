// Sky dome with a painted gradient, a sun and drifting two-tone clouds, plus
// two rings of far mountains: flat cool blue-green bands, one value step
// apart, that the haze carries towards the horizon blue.
import { BackSide, BufferAttribute, BufferGeometry, Group, Mesh, MeshBasicNodeMaterial, SphereGeometry, type Camera } from 'three/webgpu'
import { cameraPosition, color, float, Fn, mix, mrt, normalize, normalWorld, positionWorld, smoothstep, texture, vec4 } from 'three/tsl'
import type { Environment } from '../materials/environment'
import { cumulus } from './cumulus'
import { Noise2D, subSeed } from '../rng'

const SKY_RADIUS = 1800

export function createSky(env: Environment) {
  const group = new Group()
  group.name = 'sky'

  const dir = normalize(positionWorld.sub(cameraPosition))
  const up = dir.y
  const sunDot = dir.dot(env.sunDirection).max(0)

  const clouds = cumulus(env, dir)
  const cover = clouds.cover
  const disk = smoothstep(0.99955, 0.99975, sunDot).mul(cover.oneMinus())

  const colorNode = Fn(() => {
    const gradient = smoothstep(-0.02, 0.7, up).pow(0.7)
    let sky = mix(env.horizon, env.zenith, gradient)
    sky = sky.add(env.sunHaze.mul(sunDot.pow(12).mul(0.5)))
    const cloudFinal = mix(env.horizon, clouds.tone, smoothstep(0, 0.3, up).mul(0.65).add(0.35))
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

  group.add(createRange(env, { radius: 360, depth: 190, base: -16, low: 8, high: 100, rock: '#4e737c', snowLine: Infinity, shift: 0 }))
  group.add(createRange(env, { radius: 900, depth: 200, base: -60, low: 70, high: 210, rock: '#7193a9', snowLine: 0.6, shift: 31 }))

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
  const rows = 18
  const positions = new Float32Array((segments + 1) * (rows + 1) * 3)
  const index: number[] = []
  for (let s = 0; s <= segments; s++) {
    const a = (s / segments) * Math.PI * 2
    const cx = Math.cos(a)
    const cz = Math.sin(a)
    const ridge = 1 - Math.abs(noise.fbm(cx * 2.6 + range.shift, cz * 2.6, 3))
    const broad = noise.fbm(cx * 1.1 - range.shift, cz * 1.1, 2) * 0.5 + 0.5
    const peak = range.low + (range.high - range.low) * Math.pow(ridge, 4) * (0.25 + broad)
    for (let r = 0; r <= rows; r++) {
      const f = r / rows
      const shoulder = noise.fbm(cx * 5 + f * 2 + range.shift, cz * 5 - f * 3, 2)
      const y = range.base + (peak - range.base) * Math.pow(f, 1.65)
        + shoulder * range.high * 0.25 * Math.sin(f * Math.PI)
      const wobble = noise.sample(cx * 4 + f * 2 + range.shift, cz * 4 - f) * range.depth * 0.24 * (1 - f)
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

  // Painted, not cel-lit: a gentle sun-side lift and a lighter crest keep the
  // band flat at a distance, without facets turning into stripes.
  const colorNode = Fn(() => {
    const sunSide = smoothstep(-0.2, 0.8, normalWorld.dot(env.sunDirection)).mul(0.14).add(0.92)
    const crest = mix(float(0.92), float(1.04), positionWorld.y.div(range.high).clamp(0, 1))
    const rock = color(range.rock).mul(sunSide).mul(crest)
    if (!Number.isFinite(range.snowLine)) return rock
    // The snow line wanders along the ridge, so it never reads as one level cut.
    const line = texture(env.noise, positionWorld.xz.div(700)).r.sub(0.5).mul(0.3).add(range.snowLine)
    const snow = smoothstep(line, line.add(0.08), positionWorld.y.div(range.high))
    return mix(rock, color('#e4ecf4').mul(sunSide), snow)
  })()
  const material = new MeshBasicNodeMaterial()
  material.colorNode = colorNode
  material.name = 'range'
  const mesh = new Mesh(geometry, material)
  mesh.name = 'range'
  mesh.frustumCulled = false
  return mesh
}
