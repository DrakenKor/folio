// Uniforms shared by every material in one scene: time, light, wind and haze.
// Each scene owns one Environment, so two views never fight over globals.
import { Color, type Node, type UniformNode, DataTexture, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, RGBAFormat, UnsignedByteType, Vector2, Vector3 } from 'three/webgpu'
import { abs, float, positionWorld, smoothstep, step, texture, uniform } from 'three/tsl'
import { Noise2D, subSeed } from '../rng'

export interface Palette {
  sun: string
  skyFill: string
  groundFill: string
  zenith: string
  horizon: string
  haze: string
  sunHaze: string
}

export const MEADOW_PALETTE: Palette = {
  sun: '#ffe7c2',
  skyFill: '#b8b3e3',
  groundFill: '#aca3d0',
  zenith: '#3a72c2',
  horizon: '#b5cfee',
  haze: '#b0c8e8',
  sunHaze: '#ffdcb0'
}

export function createEnvironment(seed: number, palette: Palette = MEADOW_PALETTE) {
  const sunDirection = new Vector3()
  const env = {
    seed,
    palette,
    /** Scene time in seconds; the page decides whether it runs or is frozen. */
    time: uniform(0),
    /** Unit vector pointing from the ground towards the sun. */
    sunDirection: uniform(sunDirection),
    /** Sun colour times intensity, matching the directional light. */
    sunColor: colorUniform(palette.sun),
    zenith: colorUniform(palette.zenith),
    horizon: colorUniform(palette.horizon),
    haze: colorUniform(palette.haze),
    sunHaze: colorUniform(palette.sunHaze),
    /** Haze extinction per metre, past `hazeStart`. */
    hazeDensity: uniform(0.0022),
    hazeStart: uniform(24),
    /** How much haze drains saturation before tinting, 0..1. */
    hazeDesaturate: uniform(0.2),
    /** Wind heading on the ground plane (unit) and strength 0..2. */
    windDirection: uniform(new Vector2(0.8, 0.6).normalize()),
    windStrength: uniform(1),
    /** A soft local light shared by every cel surface; disabled until a landmark is placed. */
    landmark: {
      position: uniform(new Vector3()),
      color: colorUniform('#65e9df'),
      radius: uniform(1),
      strength: uniform(0)
    },
    /** Where the player stands: grass bends away and the ground is trampled around it. */
    player: uniform(new Vector3()),
    /** Radius of trampled, shortened grass, as where fights happen. */
    trampleRadius: uniform(3.2),
    /** Cloud density threshold: higher means clearer sky. */
    cloudCover: uniform(0.56),
    /** How much a passing cloud darkens the ground, 0..1. */
    cloudShadow: uniform(0.32),
    /** Cel band shape shared by every cel material. */
    bands: {
      terminator: uniform(0.02),
      highlight: uniform(0.36),
      mid: uniform(0.58),
      softness: uniform(0.06)
    },
    /** Shade, rim and ink rules shared by every cel material. */
    shading: {
      /** Shade hue; surfaces keep their luminance and take this hue by `shadeHue`. */
      shadeTint: uniform(new Vector3(0.7, 0.62, 1)),
      /** How far shade moves from the surface colour to the shade hue, 0..1. */
      shadeHue: uniform(0.7),
      /** Shade brightness relative to the surface under the sky fill. */
      shadeValue: uniform(1.22),
      /** How much of the fill lit faces lose, 0..1. */
      fillInLight: uniform(0.75),
      litSaturation: uniform(0.85),
      /** Faint warm rim on the lit side of silhouettes, 0..1. */
      rim: uniform(0.28),
      /** Outline colour: surface colour times this value, shifted by `inkTint`. */
      inkValue: uniform(0.2),
      inkTint: colorUniform('#c4ccff')
    },
    /** Tileable seeded noise: r low, g mid, b high frequency, a cellular-ish. */
    noise: createNoiseTexture(subSeed(seed, 'noise'))
  }
  return env
}

export type Environment = ReturnType<typeof createEnvironment>

/** Cloud density on the cloud layer at `uv`; the sky and the ground share it. */
export function cloudDensity(env: Environment, uv: Node<'vec2'>) {
  return texture(env.noise, uv).level(float(2))
    .r.mul(0.85)
    .add(texture(env.noise, uv.mul(1.9).add(0.37)).level(float(2)).r.mul(0.15))
}

/** 1 in open sun, lower under the large, soft shadow of a drifting cloud. */
export function cloudLight(env: Environment) {
  const toLayer = env.sunDirection.xz.div(env.sunDirection.y.max(0.15)).mul(positionWorld.y.negate().add(300))
  const uv = positionWorld.xz.add(toLayer).mul(0.0011).sub(env.windDirection.mul(env.time.mul(0.0022)))
  const density = cloudDensity(env, uv)
  // Only the densest cloud cores cast, so shadows stay sparse.
  return smoothstep(env.cloudCover.add(0.04), env.cloudCover.add(0.2), density).mul(env.cloudShadow).oneMinus()
}

/**
 * Blotchy world-space noise from the mid-frequency channel, projected from
 * three axes and blended by the normal so no surface sees it stretched.
 */
export function triplanarNoise(env: Environment, p: Node<'vec3'>, n: Node<'vec3'>, scale: number) {
  const w = abs(n).pow(4)
  const sum = w.x.add(w.y).add(w.z)
  const x = texture(env.noise, p.yz.mul(scale)).g
  const y = texture(env.noise, p.zx.mul(scale)).g
  const z = texture(env.noise, p.xy.mul(scale)).g
  return x.mul(w.x).add(y.mul(w.y)).add(z.mul(w.z)).div(sum)
}

/** 1 at the player's feet, fading to 0 at the trample radius. */
export function trampleAt(env: Environment, xz: Node<'vec2'>) {
  const radius = env.trampleRadius.max(1e-4)
  return smoothstep(radius.mul(0.35), radius, xz.sub(env.player.xz).length()).oneMinus().mul(step(1e-4, env.trampleRadius))
}

/** A colour uniform typed as vec3, so it composes with vector maths. */
function colorUniform(hex: string): UniformNode<'vec3', Color> {
  return uniform(new Color(hex)) as unknown as UniformNode<'vec3', Color>
}

const NOISE_SIZE = 256

/** A 256² RGBA8 texture of tileable fractal noise at four scales. */
function createNoiseTexture(seed: number): DataTexture {
  const n = new Noise2D(seed)
  const n2 = new Noise2D(seed ^ 0x9e3779b9)
  const data = new Uint8Array(NOISE_SIZE * NOISE_SIZE * 4)
  const s = NOISE_SIZE
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const u = x / s
      const v = y / s
      const r = n.fbm(u * 4, v * 4, 4, 4)
      const g = n.fbm(u * 16, v * 16, 3, 16)
      const b = n2.fbm(u * 48, v * 48, 2, 48)
      const a = Math.abs(n2.fbm(u * 8, v * 8, 4, 8))
      const i = (y * s + x) * 4
      data[i] = Math.round(clamp01(r * 0.5 + 0.5) * 255)
      data[i + 1] = Math.round(clamp01(g * 0.5 + 0.5) * 255)
      data[i + 2] = Math.round(clamp01(b * 0.5 + 0.5) * 255)
      data[i + 3] = Math.round(clamp01(a * 1.6) * 255)
    }
  }
  const tex = new DataTexture(data, s, s, RGBAFormat, UnsignedByteType)
  tex.wrapS = tex.wrapT = RepeatWrapping
  tex.magFilter = LinearFilter
  tex.minFilter = LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.needsUpdate = true
  return tex
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x
}
