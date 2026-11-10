// A smooth shadow filter for cel shading.
//
// three's PCFShadowMap rotates its five taps per pixel with interleaved
// gradient noise, which leaves a dithered fringe that the cel bands then
// sharpen into visible stipple. This fixed 3×3 grid of hardware-compared taps
// gives a clean gradient instead. Install it with `installSmoothShadows`.
import { float, Fn, reference, renderGroup, texture, vec2 } from 'three/tsl'
import type { DepthTexture, LightShadow, Node } from 'three/webgpu'

interface FilterInputs {
  depthTexture: DepthTexture
  shadowCoord: Node<'vec3'>
  shadow: LightShadow
}

// three's typings omit setGroup on ReferenceNode and type compare() as vec4.
type Groupable<T> = { setGroup(group: unknown): T }

const smoothShadowFilter = Fn((args: { readonly [key: string]: unknown }) => {
  const { depthTexture, shadowCoord, shadow } = args as unknown as FilterInputs
  const mapSize = (reference('mapSize', 'vec2', shadow) as unknown as Groupable<Node<'vec2'>>).setGroup(renderGroup)
  const radius = (reference('radius', 'float', shadow) as unknown as Groupable<Node<'float'>>).setGroup(renderGroup)
  const step = vec2(1).div(mapSize).mul(radius)
  let sum: Node<'float'> = float(0)
  for (let y = -1; y <= 1; y++) {
    for (let x = -1; x <= 1; x++) {
      const tap = texture(depthTexture, shadowCoord.xy.add(step.mul(vec2(x, y)))).compare(shadowCoord.z)
      sum = sum.add(tap as unknown as Node<'float'>)
    }
  }
  return sum.div(9)
})

export function installSmoothShadows(shadow: LightShadow): void {
  ;(shadow as LightShadow & { filterNode?: unknown }).filterNode = smoothShadowFilter
}
