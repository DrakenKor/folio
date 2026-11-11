// Meadow foliage takes wind sheen only in direct sunlight.
import type { LightingModel, Node } from 'three/webgpu'
import { diffuseColor, mix, vec3 } from 'three/tsl'
import { CelMaterial, type CelMaterialOptions } from '../materials/cel'
import type { Environment } from '../materials/environment'

/** A cool travelling sheen from foliage turning its paler side towards the light. */
export function gustSheen(c: Node<'vec3'>, gust: Node<'float'>): Node<'vec3'> {
  return c.mul(mix(vec3(1), vec3(1.08, 1.18, 1.22), gust.max(0)))
}

/** Wind sheen affects direct sunlight; cast shadows retain their own surface tone. */
export class MeadowMaterial extends CelMaterial {
  constructor(env: Environment, options: CelMaterialOptions, private readonly sheen: Node<'float'>) {
    super(env, options)
  }

  override setupLightingModel(): LightingModel {
    const model = super.setupLightingModel()
    const direct = model.direct.bind(model)
    model.direct = (...args: Parameters<LightingModel['direct']>) => {
      const unpressed = diffuseColor.rgb.toVar()
      diffuseColor.rgb.assign(gustSheen(unpressed, this.sheen))
      direct(...args)
      diffuseColor.rgb.assign(unpressed)
    }
    return model
  }
}
