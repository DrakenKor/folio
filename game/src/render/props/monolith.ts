import { AdditiveBlending, Group, LatheGeometry, Mesh, Sprite, SpriteNodeMaterial, Vector2 } from 'three/webgpu'
import { color, mrt, normalView, positionLocal, positionViewDirection, smoothstep, uv, vec4 } from 'three/tsl'
import type { Environment } from '../materials/environment'
import type { Heightfield } from '../terrain/heightfield'
import { CelMaterial } from '../materials/cel'
import { createCarvedShaft, CRYSTAL_RISE, CYAN, SHAFT_BASE, climbingPulse } from './monolith-carving'
import { createMonolithSite } from './monolith-site'
import { createMonolithMotes } from './monolith-motes'

/** A four-sided progression carved in stone, with one ascending current of light. */
export function createMonolith(env: Environment, field: Heightfield) {
  const group = new Group()
  group.name = 'monolith'
  const { x, y, z } = field.monolith
  group.position.set(x, y - 0.25, z)
  env.landmark.position.value.set(x, y + 1.5, z)
  env.landmark.color.value.set(CYAN)
  env.landmark.radius.value = 14
  env.landmark.strength.value = 16
  group.add(createMonolithSite(env, field), createCarvedShaft(env), createMonolithMotes(env))

  const gem = createCrystal(env)
  const crystalHeight = SHAFT_BASE + CRYSTAL_RISE
  group.add(gem)

  return {
    group,
    update(_time: number) {
      const time = env.time.value
      gem.rotation.y = time * 0.19
      gem.position.y = crystalHeight + Math.sin(time * 0.65) * 0.12
      env.landmark.strength.value = 16 + Math.sin(time * 0.65) * 0.2
    }
  }
}

/** A hexagonal gem: cel-shaded facets, a core that brightens on facets facing the eye, and a soft halo. */
function createCrystal(env: Environment): Group {
  const group = new Group()
  const profile = [[0, -0.95], [0.4, -0.2], [0.34, 0.28], [0, 0.82]].map(([r, h]) => new Vector2(r, h))
  const geometry = new LatheGeometry(profile, 6).toNonIndexed()
  geometry.computeVertexNormals()
  const energy = climbingPulse(env, CRYSTAL_RISE).mul(0.9).add(1)
  const core = normalView.dot(positionViewDirection).clamp(0, 1).pow(3)
  const glow = color(CYAN).mul(energy).mul(core.mul(0.85).add(0.2))
  const material = new CelMaterial(env, { color: '#9fdcd3', emissiveNode: glow, outlineNormal: positionLocal.normalize(), landmarkSpill: 0 })
  material.name = 'monolith-crystal'
  material.mrtNode = mrt({ glow: vec4(color(CYAN).mul(energy).mul(core.mul(1.6).add(0.7)), 1) })
  group.add(new Mesh(geometry, material))

  const fade = smoothstep(0.03, 0.43, uv().sub(0.5).length()).oneMinus().pow(2.5)
  const halo = new SpriteNodeMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false })
  halo.colorNode = color(CYAN).mul(energy).mul(0.3)
  halo.opacityNode = fade
  halo.mrtNode = mrt({ glow: vec4(color(CYAN).mul(energy).mul(1.2), fade) })
  halo.name = 'monolith-crystal-halo'
  const sprite = new Sprite(halo)
  sprite.scale.setScalar(2.6)
  group.add(sprite)
  return group
}
