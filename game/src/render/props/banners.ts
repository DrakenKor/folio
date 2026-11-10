// Pennants on poles along the path: cloth that streams downwind and ripples
// with the shared gusts. Thin cloth has no volume for a hull outline, so its
// border is inked in the shader instead.
import { CylinderGeometry, Group, Matrix4, Mesh, PlaneGeometry, DoubleSide } from 'three/webgpu'
import { attribute, color, cos, faceDirection, float, Fn, min, mix, positionLocal, sin, smoothstep, step, transformNormalToView, uv, vec2, vec3 } from 'three/tsl'
import { GeometryBuilder, linearColor } from '../geometry'
import { CelMaterial } from '../materials/cel'
import type { Environment } from '../materials/environment'
import { gustAt } from '../materials/wind'
import type { Heightfield, Point } from '../terrain/heightfield'

const FLAG_LENGTH = 2.1
const FLAG_HEIGHT = 0.62
const POLE_HEIGHT = 3.8

export function createBanners(env: Environment, field: Heightfield) {
  const group = new Group()
  group.name = 'banners'
  const sites = bannerSites(field)

  const poles = new GeometryBuilder()
  const pole = new CylinderGeometry(0.055, 0.08, POLE_HEIGHT, 6)
  const finial = new CylinderGeometry(0.0, 0.11, 0.22, 6)
  for (const s of sites) {
    const y = field.heightAt(s.x, s.z)
    poles.add(pole, new Matrix4().makeTranslation(s.x, y + POLE_HEIGHT / 2 - 0.2, s.z), { color: linearColor('#5b3f2c') })
    poles.add(finial, new Matrix4().makeTranslation(s.x, y + POLE_HEIGHT - 0.2 + 0.11, s.z), { color: linearColor('#d9b25a') })
  }
  const poleMaterial = new CelMaterial(env, {
    colorNode: attribute('color', 'vec3'),
    outlineColor: vec3(0.09, 0.05, 0.04),
    outlineWidth: 0.9
  })
  poleMaterial.name = 'pole'
  const poleMesh = new Mesh(poles.build(), poleMaterial)
  poleMesh.castShadow = true
  group.add(poleMesh)

  // Pennant in local space: x along the cloth from the pole, tapering to a point.
  const flagGeo = new PlaneGeometry(FLAG_LENGTH, FLAG_HEIGHT, 20, 4)
  flagGeo.translate(FLAG_LENGTH / 2, -FLAG_HEIGHT / 2, 0)
  const pos = flagGeo.attributes.position!
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const taper = 1 - 0.78 * (x / FLAG_LENGTH)
    pos.setY(i, (pos.getY(i) + FLAG_HEIGHT / 2) * taper - (FLAG_HEIGHT / 2) * taper)
  }

  const windAngle = Math.atan2(-env.windDirection.value.y, env.windDirection.value.x)
  sites.forEach((s, i) => {
    const phase = i * 1.7
    const anchor = vec2(s.x, s.z)
    const gust = gustAt(env, anchor)
    const u = positionLocal.x.div(FLAG_LENGTH)
    const amp = u.mul(0.32).add(0.05).mul(env.windStrength.mul(0.5).add(0.5)).mul(gust.mul(0.7).add(0.65))
    const wave = positionLocal.x.mul(3.1).sub(env.time.mul(7.5)).add(phase)
    const droop = float(1).sub(env.windStrength.mul(0.55)).max(0).mul(0.45).mul(u.mul(u))
    const positionNode = vec3(
      positionLocal.x.sub(sin(wave).abs().mul(0.06).mul(u)),
      positionLocal.y.sub(droop).add(sin(wave.mul(0.5).add(1)).mul(0.04).mul(u)),
      positionLocal.z.add(sin(wave).mul(amp))
    )
    const slope = cos(wave).mul(3.1).mul(amp)
    const normal = transformNormalToView(vec3(slope.negate(), 0, 1).normalize()).mul(faceDirection)

    const colorNode = Fn(() => {
      const t = uv()
      // Distance to the cloth border in metres, for the inked edge.
      const across = min(t.y, t.y.oneMinus()).mul(FLAG_HEIGHT).mul(float(1).sub(t.x.mul(0.78)))
      const along = t.x.oneMinus().mul(FLAG_LENGTH)
      const edge = min(across, along)
      const base = i % 2 === 0 ? color('#c6402e') : color('#2f5fa8')
      const band = step(0.1, t.x).mul(step(t.x, 0.18))
      const cloth = mix(base, color('#f1e6cc'), band)
      return mix(cloth, cloth.mul(0.22), smoothstep(0.018, 0.035, edge).oneMinus())
    })()

    const flagMaterial = new CelMaterial(env, {
      colorNode,
      positionNode,
      normalNode: normal,
      side: DoubleSide,
      outlineColor: null
    })
    flagMaterial.name = 'pennant'
    const flag = new Mesh(flagGeo, flagMaterial)
    flag.position.set(s.x, field.heightAt(s.x, s.z) + POLE_HEIGHT - 0.42, s.z)
    flag.rotation.y = windAngle
    flag.castShadow = true
    group.add(flag)
  })

  return { group, sites }
}

/** Beside the path: two on the approach to the monolith, one in the player's view. */
function bannerSites(field: Heightfield): Point[] {
  const { pathLine, monolith, player } = field
  const sides: Point[] = []
  const offset = (i: number, side: number, by: number): Point => {
    const p = pathLine[i]!
    const q = pathLine[Math.min(i + 1, pathLine.length - 1)]!
    const len = Math.hypot(q.x - p.x, q.z - p.z) || 1
    return { x: p.x - ((q.z - p.z) / len) * by * side, z: p.z + ((q.x - p.x) / len) * by * side }
  }
  // Only the first half of the path leads to the monolith.
  const half = Math.floor(pathLine.length * 0.62)
  const approach = pathLine.slice(0, half)
  const nearMonolith = (d: number) => {
    let best = 0
    let bestErr = Infinity
    approach.forEach((p, i) => {
      const err = Math.abs(Math.hypot(p.x - monolith.x, p.z - monolith.z) - d)
      if (err < bestErr) {
        bestErr = err
        best = i
      }
    })
    return best
  }
  sides.push(offset(nearMonolith(13), 1, 2.1))
  sides.push(offset(nearMonolith(24), -1, 2.1))
  // The third stands in the player's view, across the path from them.
  sides.push({ x: player.x + 5.4, z: player.z + 1.2 })
  return sides
}
