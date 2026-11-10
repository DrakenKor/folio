// Crisp rounded cloud silhouettes with warm tops and lavender bases.
import type { Node } from 'three/webgpu'
import { atan, color, cos, float, fwidth, mix, sin, smoothstep, vec2 } from 'three/tsl'
import type { Environment } from '../materials/environment'

/** Four differently proportioned cloud groups leave the landmark's sky open. */
export function cumulus(env: Environment, direction: Node<'vec3'>) {
  const heading = atan(direction.x, direction.z.negate())
  const drift = env.time.mul(0.0005)
  let cover: Node<'float'> = float(0)
  let tone: Node<'vec3'> = color('#fff2da').rgb
  for (const [azimuth, elevation, width, height, lean] of [
    [0.02, 0.18, 0.18, 0.065, -0.15],
    [1.10, 0.21, 0.2, 0.085, 0.2],
    [0.28, 0.25, 0.085, 0.035, 0.1],
    [-1.1, 0.34, 0.34, 0.15, -0.2]
  ] as const) {
    const angle = heading.sub(azimuth).sub(drift)
    const p = vec2(atan(sin(angle), cos(angle)).div(width), direction.y.sub(elevation).div(height)).toVar()
    let shape: Node<'float'> = float(-10)
    for (const [x, y, rx, ry] of [
      [0, -0.3, 1, 0.35],
      [-0.6, -0.06, 0.44, 0.47],
      [-0.2, 0.24, 0.46, 0.76],
      [0.36, 0.1, 0.49, 0.61],
      [0.78, -0.17, 0.32, 0.34]
    ] as const) {
      const lobe = p.sub(vec2(x + y * lean, y + lean * x * 0.3)).div(vec2(rx * (1 + lean * x), ry)).length().oneMinus()
      shape = shape.max(lobe)
    }
    shape = shape.min(p.y.add(0.55)).sub(env.cloudCover.sub(0.56).mul(1.5)).toVar()
    const aa = fwidth(shape).max(0.001)
    const mask = smoothstep(aa.negate(), aa, shape)
    const base = smoothstep(-0.28, -0.25, p.y.add(sin(p.x.mul(6)).mul(0.045)))
    const cloud = mix(color('#adb0cc'), color('#fff1d7'), base)
    tone = mix(tone, cloud, mask)
    cover = cover.max(mask)
  }
  return { cover, tone }
}
