// Aerial perspective: distance haze that turns blue away from the sun and warm
// towards it, thicker in low ground. Installed as the scene's fog node, so
// every lit material and its outline fade the same way.
import { cameraPosition, exp, Fn, mix, output, positionWorld, vec4 } from 'three/tsl'
import type { Environment } from './environment'

export function hazeFog(env: Environment) {
  return Fn(() => {
    const toFrag = positionWorld.sub(cameraPosition).toVar()
    const dist = toFrag.length().max(1e-3)
    const dir = toFrag.div(dist)
    const meanHeight = positionWorld.y.add(cameraPosition.y).mul(0.5)
    const thickness = exp(meanHeight.mul(-0.018)).clamp(0.45, 1.25)
    const optical = dist.sub(env.hazeStart).max(0).mul(env.hazeDensity).mul(thickness)
    const amount = exp(optical.negate()).oneMinus()
    const sun = dir.dot(env.sunDirection).max(0).pow(6)
    const colour = mix(env.haze, env.sunHaze, sun.mul(0.8))
    return vec4(mix(output.rgb, colour, amount), output.a)
  })()
}
