// Cel shading for every lit mesh: three soft bands of warm key light over a
// cool blue shade band from the sky fill. Cast and cloud shadows fade
// the bands straight to shade with one soft edge, a faint warm rim catches
// lit silhouettes, and one ink rule colours every outline.
import { LightingModel, MeshToonNodeMaterial, type MeshToonNodeMaterialParameters, type Node } from 'three/webgpu'
import { BRDF_Lambert, diffuseColor, dot, float, fwidth, mix, normalView, normalWorld, positionView, positionViewDirection, positionWorld, smoothstep, texture, uniform, vec3 } from 'three/tsl'
import { cloudLight, type Environment } from './environment'

/** Band shape, held on the environment so one slider moves every material. */
export interface CelBands {
  /** dot(N, L) where the shade band turns to the mid band. */
  terminator: Node<'float'>
  /** dot(N, L) where the mid band turns to full light. */
  highlight: Node<'float'>
  /** Light level of the mid band, 0..1. */
  mid: Node<'float'>
  /** Half-width of each band transition. */
  softness: Node<'float'>
}

/** Outline width in physical pixels at close range; outlines and inked cloth edges share it. */
export const inkWidth = uniform(2)

const LUMA = vec3(0.2126, 0.7152, 0.0722)
/** Darkest an outline gets, so ink never reads as black. */
const INK_FLOOR = vec3(0.035, 0.03, 0.055)

/** Ink width in pixels at a view depth: full up close, thinner far away, never under ~0.7 px. */
export function inkPixels(depth: Node<'float'>): Node<'float'> {
  return inkWidth.mul(float(18).div(depth.max(1)).clamp(0.35, 1))
}

/** The ink rule: the surface colour, darker and slightly cooler, never black. */
export function inkColor(env: Environment, surface: Node<'vec3'>): Node<'vec3'> {
  const { inkValue, inkTint } = env.shading
  return mix(vec3(dot(surface, LUMA)), surface, 1.2).max(0).mul(inkValue).mul(inkTint).max(INK_FLOOR)
}

/** 1 within the ink width of an edge, given the distance to it in any unit; for shader-inked thin surfaces. */
export function inkEdge(distance: Node<'float'>): Node<'float'> {
  const pixels = distance.div(fwidth(distance).max(1e-6))
  return smoothstep(-0.5, 0.5, pixels.sub(inkPixels(positionView.z.negate()))).oneMinus()
}

// three's typings leave these loosely typed; this is the shape it passes.
interface DirectInput {
  lightDirection: Node<'vec3'>
  lightColor: Node<'vec3'>
  lightNode: { baseColorNode: Node<'vec3'> | null; shadowNode: Node<'float'> | null }
  reflectedLight: { directDiffuse: Node<'vec3'> }
}

interface IndirectContext {
  irradiance: Node<'vec3'>
  ambientOcclusion: Node<'float'>
  reflectedLight: { indirectDiffuse: Node<'vec3'> }
}

type DirectArgs = Parameters<LightingModel['direct']>
type IndirectArgs = Parameters<LightingModel['indirect']>

const lambert = (albedo: Node) => BRDF_Lambert({ diffuseColor: albedo }) as unknown as Node<'vec3'>

class CelLightingModel extends LightingModel {
  /** Direct light reaching the surface, 0..1; set by `direct`, read by `indirect`. */
  private lightAmount: Node<'float'> = float(0)

  constructor(
    private readonly env: Environment,
    private readonly bandOffset: Node<'float'> | null,
    private readonly readability: boolean
  ) {
    super()
  }

  override direct(...[input, builder]: DirectArgs): void {
    const { lightDirection, lightColor, lightNode, reflectedLight } = input as unknown as DirectInput
    const { terminator, highlight, mid, softness }: CelBands = this.env.bands
    // Take the light unshadowed and fold the shadow term in below, so it never crosses the bands.
    const receives = (builder as unknown as { object: { receiveShadow: boolean } }).object.receiveShadow && lightNode.shadowNode !== null
    const light = receives ? lightNode.baseColorNode ?? lightColor : lightColor
    const shadowMap = receives ? lightNode.shadowNode! : float(1)

    const ndl = normalView.dot(lightDirection)
    let t: Node<'float'> = ndl
    // Painterly terminator breakup up close, calm broad bands in the distance.
    if (this.bandOffset) t = t.add(this.bandOffset.mul(smoothstep(25, 90, positionView.z.negate()).oneMinus()))
    const form = smoothstep(terminator.sub(softness), terminator.add(softness), t)
      .mul(mid)
      .add(smoothstep(highlight.sub(softness), highlight.add(softness), t).mul(float(1).sub(mid)))
    // Faces turning from the light are already in shade; ignoring the map there removes acne.
    const facing = smoothstep(terminator, terminator.add(0.15), ndl)
    const cast = mix(float(1), shadowMap, facing).mul(cloudLight(this.env))
    const lit = smoothstep(0.15, 0.85, cast)
    this.lightAmount = form.mul(lit).toVar()
    const albedo = mix(vec3(dot(diffuseColor.rgb, LUMA)), diffuseColor.rgb, this.env.shading.litSaturation)
    reflectedLight.directDiffuse.addAssign(light.mul(form.mul(lit)).mul(lambert(albedo)).mul(this.readability ? 1.5 : 1))

    // Warm rim on lit silhouettes; upward faces (ground, grass) never rim.
    const edge = float(1).sub(normalView.dot(positionViewDirection).clamp(0, 1))
    const rim = smoothstep(0.55, 0.95, edge)
      .mul(smoothstep(0.0, 0.3, ndl))
      .mul(smoothstep(0.5, 0.85, normalWorld.y).oneMinus())
      .mul(lit)
      .mul(this.env.shading.rim)
      .mul(this.readability ? 1.5 : 1)
    reflectedLight.directDiffuse.addAssign(light.mul(rim).mul(lambert(mix(diffuseColor.rgb, vec3(1), 0.5))))
  }

  override indirect(...[builder]: IndirectArgs): void {
    const { irradiance, ambientOcclusion, reflectedLight } = builder.context as unknown as IndirectContext
    // Fill: the surface's luminance in one cool blue hue, keeping part of its own
    // colour so patterns still read in shade. Lit faces take less of it, so shade
    // stays light without washing out the sun side.
    const { shadeTint, shadeHue, shadeValue, fillInLight } = this.env.shading
    const albedo = diffuseColor.rgb
    const cool = shadeTint.mul(dot(albedo, LUMA).div(dot(shadeTint, LUMA)))
    const shade = mix(albedo, cool, shadeHue).mul(shadeValue)
    const fill = this.lightAmount.mul(fillInLight).oneMinus()
    reflectedLight.indirectDiffuse.addAssign(dot(irradiance, LUMA).mul(lambert(shade)).mul(fill))
    reflectedLight.indirectDiffuse.mulAssign(ambientOcclusion)
    const landmark = this.env.landmark
    const delta = landmark.position.sub(positionWorld)
    const falloff = smoothstep(0, landmark.radius, delta.length()).oneMinus().pow(2)
    const facing = normalWorld.dot(delta.normalize()).max(0).mul(0.7).add(0.3)
    reflectedLight.indirectDiffuse.addAssign(landmark.color.mul(landmark.strength).mul(falloff).mul(facing).mul(lambert(albedo)))
  }
}

export interface CelMaterialOptions extends MeshToonNodeMaterialParameters {
  /** Lifts band values and the shared warm rim for focal subjects. */
  readability?: boolean
  /** Outline colour override; omit for the ink rule, null for no outline. */
  outlineColor?: Node<'vec3'> | null
  /** Outline width relative to the ink width; 0 draws none. */
  outlineWidth?: number
  /** Local-space normal the outline hull is pushed along (smooth for faceted meshes). */
  outlineNormal?: Node<'vec3'> | null
  /** Added to dot(N, L) before banding: painterly breakup of the terminator, faded with distance. */
  bandOffset?: Node<'float'> | null
  /** Light the surface gives off; add it to the glow target via mrtNode to bloom. */
  emissiveNode?: Node | null
  flatShading?: boolean
}

/**
 * A toon node material with the cel lighting model. It stays a
 * `MeshToonNodeMaterial` so stock toon tooling still recognises it.
 */
export class CelMaterial extends MeshToonNodeMaterial {
  readonly isCelMaterial = true
  /** Whether the outline pass draws a hull for this material. */
  outline: boolean
  /** Explicit outline colour; null follows the ink rule. */
  outlineColor: Node<'vec3'> | null
  outlineWidth: number
  outlineNormal: Node<'vec3'> | null
  emissiveNode: Node | null
  /** Facet normals from screen derivatives; toon materials lack the typed field. */
  flatShading: boolean
  private readonly bandOffset: Node<'float'> | null
  private readonly readability: boolean

  constructor(
    readonly env: Environment,
    options: CelMaterialOptions = {}
  ) {
    const { outlineColor, outlineWidth = 1, outlineNormal = null, bandOffset = null, emissiveNode = null, flatShading = false, readability = false, ...params } = options
    super(params)
    this.emissiveNode = emissiveNode
    this.flatShading = flatShading
    this.outline = outlineColor !== null
    this.outlineColor = outlineColor ?? null
    this.outlineWidth = outlineWidth
    this.outlineNormal = outlineNormal
    this.bandOffset = bandOffset
    this.readability = readability
  }

  /** The unlit surface colour, as the ink rule sees it. */
  surfaceColor(): Node<'vec3'> {
    if (this.colorNode) return (this.colorNode as Node<'vec4'>).rgb
    const base = uniform(this.color) as unknown as Node<'vec3'>
    return this.map ? texture(this.map).rgb.mul(base) : base
  }

  /** Outline colour for this surface: the explicit override or the ink rule. */
  inkColor(): Node<'vec3'> {
    return this.outlineColor ?? inkColor(this.env, this.surfaceColor())
  }

  override setupLightingModel(): LightingModel {
    return new CelLightingModel(this.env, this.bandOffset, this.readability)
  }
}

export function isCelMaterial(material: unknown): material is CelMaterial {
  return (material as CelMaterial | null)?.isCelMaterial === true
}
