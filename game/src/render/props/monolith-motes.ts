import { InstancedBufferGeometry, Mesh, SphereGeometry } from 'three/webgpu'
import { color, cos, fract, hash, instanceIndex, mrt, normalView, positionLocal, positionViewDirection, sin, smoothstep, vec3, vec4 } from 'three/tsl'
import { CelMaterial } from '../materials/cel'
import type { Environment } from '../materials/environment'
import { windAt } from '../materials/wind'

/** Sparse soft spheres spiral upward and lean downwind with the meadow's shared gust. */
export function createMonolithMotes(env: Environment): Mesh {
  const source = new SphereGeometry(0.045, 10, 8)
  const geometry = new InstancedBufferGeometry()
  geometry.index = source.index
  geometry.setAttribute('position', source.attributes.position!)
  geometry.setAttribute('normal', source.attributes.normal!)
  geometry.instanceCount = 24
  const r0 = hash(instanceIndex)
  const r1 = hash(instanceIndex.add(101))
  const r2 = hash(instanceIndex.add(211))
  const life = fract(env.time.mul(0.045).add(r0))
  const angle = r2.mul(Math.PI * 2).add(env.time.mul(0.16)).add(life.mul(2.2))
  const radius = r1.mul(1.3).add(1.65)
  const wind = windAt(env, env.landmark.position.xz)
  const drift = env.windDirection.mul(life.mul(2.4).add(wind.lean.mul(0.45)))
  const centre = vec3(cos(angle).mul(radius).add(drift.x), life.mul(9).add(0.5), sin(angle).mul(radius).add(drift.y))
  const fade = smoothstep(0, 0.18, life).mul(smoothstep(0.75, 1, life).oneMinus())
  const glow = color('#65e9df').mul(fade).mul(1.1)
  const material = new CelMaterial(env, { color: '#a3ded4', outlineColor: null, transparent: true, depthWrite: false })
  material.positionNode = positionLocal.mul(fade.mul(0.6).add(0.3)).add(centre)
  material.opacityNode = smoothstep(0, 0.7, normalView.dot(positionViewDirection).max(0)).mul(fade).mul(0.72)
  material.emissiveNode = glow
  material.mrtNode = mrt({ glow: vec4(glow, 1) })
  material.name = 'monolith-motes'
  const mesh = new Mesh(geometry, material)
  mesh.frustumCulled = false
  return mesh
}
