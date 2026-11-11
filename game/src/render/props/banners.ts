// Pennants on poles along the path: cloth that streams downwind and ripples
// with the shared gusts. Thin cloth has no volume for a hull outline, so its
// border is inked in the shader instead.
import { CylinderGeometry, Group, Matrix4, Mesh, PlaneGeometry, DoubleSide } from 'three/webgpu'
import { attribute, color, cos, faceDirection, float, Fn, min, mix, positionLocal, sin, step, transformNormalToView, uv, vec2, vec3 } from 'three/tsl'
import { GeometryBuilder, linearColor } from '../geometry'
import { CelMaterial, inkColor, inkEdge } from '../materials/cel'
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
  const pole = new CylinderGeometry(0.065, 0.095, POLE_HEIGHT, 12)
  const finial = new CylinderGeometry(0.0, 0.11, 0.22, 6)
  for (const s of sites) {
    const y = field.heightAt(s.x, s.z)
    poles.add(pole, new Matrix4().makeTranslation(s.x, y + POLE_HEIGHT / 2 - 0.2, s.z), { color: linearColor('#5b3f2c') })
    poles.add(finial, new Matrix4().makeTranslation(s.x, y + POLE_HEIGHT - 0.2 + 0.11, s.z), { color: linearColor('#d9b25a') })
  }
  const poleMaterial = new CelMaterial(env, {
    colorNode: attribute('color', 'vec3')
  })
  poleMaterial.name = 'pole'
  const poleMesh = new Mesh(poles.build(), poleMaterial)
  poleMesh.castShadow = poleMesh.receiveShadow = true
  group.add(poleMesh)

  // Pennant in local space: x along the cloth from the pole, tapering to a point.
  const flagGeo = new PlaneGeometry(FLAG_LENGTH, FLAG_HEIGHT, 32, 6)
  flagGeo.translate(FLAG_LENGTH / 2, -FLAG_HEIGHT / 2, 0)
  const pos = flagGeo.attributes.position!
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const taper = 1 - 0.94 * (x / FLAG_LENGTH)
    pos.setY(i, (pos.getY(i) + FLAG_HEIGHT / 2) * taper - (FLAG_HEIGHT / 2) * taper)
  }

  const windAngle = Math.atan2(-env.windDirection.value.y, env.windDirection.value.x)
  sites.forEach((s, i) => {
    const phase = i * 1.7
    const anchor = vec2(s.x, s.z)
    const gust = gustAt(env, anchor)
    const u = positionLocal.x.div(FLAG_LENGTH)
    const drive = gust.mul(env.windStrength).clamp(0, 1).toVar()
    const stretch = drive.mul(0.62).add(0.38)
    const droop = drive.mul(-0.84).add(0.98)
    const slow = positionLocal.x.mul(3.1).sub(env.time.mul(2.2)).add(phase)
    const fast = positionLocal.x.mul(5.5).sub(env.time.mul(10)).add(phase)
    const calmAmp = drive.oneMinus().mul(0.018).mul(env.windStrength)
    const gustAmp = drive.mul(0.24)
    const ripple = sin(slow).mul(calmAmp).add(sin(fast).mul(gustAmp))
    const positionNode = vec3(
      positionLocal.x.mul(stretch),
      positionLocal.y.sub(droop.mul(u.pow(1.7))).add(sin(fast.mul(0.65)).mul(drive).mul(u).mul(0.055)),
      positionLocal.z.add(ripple.mul(u))
    )
    const slope = ripple.div(FLAG_LENGTH).add(u.mul(
      cos(slow).mul(calmAmp).mul(3.1).add(cos(fast).mul(gustAmp).mul(5.5))
    ))
    const normal = transformNormalToView(vec3(slope.negate(), 0, stretch).normalize()).mul(faceDirection)

    const colorNode = Fn(() => {
      const t = uv()
      // Distance to the cloth border in metres, for the inked edge.
      const across = min(t.y, t.y.oneMinus()).mul(FLAG_HEIGHT).mul(float(1).sub(t.x.mul(0.94)))
      const along = min(t.x, t.x.oneMinus()).mul(FLAG_LENGTH).mul(stretch)
      const edge = min(across, along)
      const base = i % 2 === 0 ? color('#c64b35') : color('#b55336')
      const band = step(0.1, t.x).mul(step(t.x, 0.18))
      const cloth = mix(base, color('#f1e6cc'), band)
      return mix(cloth, inkColor(env, cloth), inkEdge(edge))
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
    flag.castShadow = flag.receiveShadow = true
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
