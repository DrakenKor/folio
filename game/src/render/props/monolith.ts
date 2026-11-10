import { Group, Mesh, OctahedronGeometry } from 'three/webgpu'
import { color, mrt, normalLocal, vec4 } from 'three/tsl'
import type { Environment } from '../materials/environment'
import type { Heightfield } from '../terrain/heightfield'
import { CelMaterial } from '../materials/cel'
import { createCarvedShaft, SHAFT_BASE, SHAFT_HEIGHT, climbingPulse } from './monolith-carving'
import { createMonolithSite } from './monolith-site'
import { createMonolithMotes } from './monolith-motes'

const CYAN = '#65e9df'

/** A four-sided progression carved in stone, with one ascending current of light. */
export function createMonolith(env: Environment, field: Heightfield) {
  const group = new Group()
  group.name = 'monolith'
  const { x, y, z } = field.monolith
  group.position.set(x, y - 0.25, z)
  env.landmark.position.value.set(x, y + 1.5, z)
  env.landmark.color.value.set(CYAN)
  env.landmark.radius.value = 12
  env.landmark.strength.value = 7
  group.add(createMonolithSite(env, field), createCarvedShaft(env), createMonolithMotes(env))

  const geometry = new OctahedronGeometry(0.48, 0)
  geometry.scale(1, 1.65, 1)
  const energy = climbingPulse(env, SHAFT_HEIGHT + 0.9).mul(0.3).add(1.1)
  const glow = color(CYAN).mul(energy).mul(normalLocal.y.abs().mul(0.35).add(0.65))
  const material = new CelMaterial(env, { color: '#bbdbd1', emissiveNode: glow, flatShading: true })
  material.name = 'monolith-crystal'
  material.mrtNode = mrt({ glow: vec4(glow, 1) })
  const crystal = new Mesh(geometry, material)
  const crystalHeight = SHAFT_BASE + SHAFT_HEIGHT + 2.05
  group.add(crystal)

  return {
    group,
    update(_time: number) {
      const time = env.time.value
      crystal.rotation.y = time * 0.19
      crystal.position.y = crystalHeight + Math.sin(time * 0.65) * 0.12
      env.landmark.strength.value = 7 + Math.sin(time * 0.65) * 0.2
    }
  }
}
