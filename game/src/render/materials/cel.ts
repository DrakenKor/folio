// Cel shading: three soft bands of warm key light over a cool hemisphere fill,
// with the shadow map folded into the bands so cast shadows land on the shade
// band instead of punching a separate dark layer.
import { LightingModel, MeshToonNodeMaterial, type MeshToonNodeMaterialParameters, type Node } from 'three/webgpu'
import { BRDF_Lambert, diffuseColor, float, normalView, smoothstep, vec3 } from 'three/tsl'
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

// three's typings leave these loosely typed; this is the shape it passes.
interface DirectInput {
  lightDirection: Node<'vec3'>
  lightColor: Node<'vec3'>
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
  constructor(
    private readonly env: Environment,
    private readonly bandOffset: Node<'float'> | null
  ) {
    super()
  }

  override direct(...[input]: DirectArgs): void {
    const { lightDirection, lightColor, reflectedLight } = input as unknown as DirectInput
    const { terminator, highlight, mid, softness }: CelBands = this.env.bands
    // The light colour arrives already multiplied by the shadow term; recover it.
    const sunColor = this.env.sunColor
    const unlit = sunColor.dot(vec3(1)).max(1e-4)
    const shadow = lightColor.dot(vec3(1)).div(unlit).clamp(0, 1).mul(cloudLight(this.env))
    let t = normalView.dot(lightDirection).clamp(0, 1).mul(shadow)
    if (this.bandOffset) t = t.add(this.bandOffset)
    const band = smoothstep(terminator.sub(softness), terminator.add(softness), t)
      .mul(mid)
      .add(smoothstep(highlight.sub(softness), highlight.add(softness), t).mul(float(1).sub(mid)))
    reflectedLight.directDiffuse.addAssign(sunColor.mul(band).mul(lambert(diffuseColor.rgb)))
  }

  override indirect(...[builder]: IndirectArgs): void {
    const { irradiance, ambientOcclusion, reflectedLight } = builder.context as unknown as IndirectContext
    reflectedLight.indirectDiffuse.addAssign(irradiance.mul(lambert(diffuseColor.rgb)))
    reflectedLight.indirectDiffuse.mulAssign(ambientOcclusion)
  }
}

export interface CelMaterialOptions extends MeshToonNodeMaterialParameters {
  /** Outline colour; null draws no outline. */
  outlineColor?: Node<'vec3'> | null
  /** Outline width relative to the pass width. */
  outlineWidth?: number
  /** Local-space normal the outline hull is pushed along (smooth for faceted meshes). */
  outlineNormal?: Node<'vec3'> | null
  /** Added to dot(N, L) before banding: painterly breakup of the terminator. */
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
  outlineColor: Node<'vec3'> | null
  outlineWidth: number
  outlineNormal: Node<'vec3'> | null
  emissiveNode: Node | null
  /** Facet normals from screen derivatives; toon materials lack the typed field. */
  flatShading: boolean
  private readonly bandOffset: Node<'float'> | null

  constructor(
    private readonly env: Environment,
    options: CelMaterialOptions = {}
  ) {
    const { outlineColor = null, outlineWidth = 1, outlineNormal = null, bandOffset = null, emissiveNode = null, flatShading = false, ...params } = options
    super(params)
    this.emissiveNode = emissiveNode
    this.flatShading = flatShading
    this.outlineColor = outlineColor
    this.outlineWidth = outlineWidth
    this.outlineNormal = outlineNormal
    this.bandOffset = bandOffset
  }

  override setupLightingModel(): LightingModel {
    return new CelLightingModel(this.env, this.bandOffset)
  }
}

export function isCelMaterial(material: unknown): material is CelMaterial {
  return (material as CelMaterial | null)?.isCelMaterial === true
}
