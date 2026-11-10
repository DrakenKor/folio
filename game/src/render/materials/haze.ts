// Aerial perspective pulls colour towards the horizon blue, thicker in low
// ground. The curve stays light over the meadow and builds over the far
// mountains. Lit materials and their outlines share it.
import { cameraPosition, dot, exp, Fn, mix, output, positionWorld, vec3, vec4 } from 'three/tsl'
import type { Environment } from './environment'

export function hazeFog(env: Environment) {
  return Fn(() => {
    const toFrag = positionWorld.sub(cameraPosition).toVar()
    const dist = toFrag.length().max(1e-3)
    const meanHeight = positionWorld.y.add(cameraPosition.y).mul(0.5)
    const thickness = exp(meanHeight.mul(-0.018)).clamp(0.45, 1.25)
    const optical = dist.sub(env.hazeStart).max(0).mul(env.hazeDensity).mul(thickness)
    const amount = exp(optical.pow(1.5).negate()).oneMinus()
    const luma = dot(output.rgb, vec3(0.2126, 0.7152, 0.0722))
    const faded = mix(output.rgb, vec3(luma), amount.mul(env.hazeDesaturate))
    return vec4(mix(faded, env.horizon, amount), output.a)
  })()
}
