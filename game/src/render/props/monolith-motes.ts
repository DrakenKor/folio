import { AdditiveBlending, InstancedBufferGeometry, Mesh, MeshBasicNodeMaterial, SphereGeometry } from 'three/webgpu'
import { color, cos, fract, hash, instanceIndex, mrt, normalView, positionLocal, positionViewDirection, sin, smoothstep, vec3, vec4 } from 'three/tsl'
import type { Environment } from '../materials/environment'
import { windAt } from '../materials/wind'
import { CYAN } from './monolith-carving'

/** Sparse soft glows spiral upward and lean downwind with the meadow's shared gust. */
export function createMonolithMotes(env: Environment): Mesh {
  const source = new SphereGeometry(0.15, 10, 8)
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
  // A bright centre with a soft halo: the sphere's face-on middle is opaque, its rim fades out.
  const halo = normalView.dot(positionViewDirection).max(0).pow(3).mul(fade)
  const material = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending })
  material.positionNode = positionLocal.mul(fade.mul(0.5).add(0.5)).add(centre)
  material.colorNode = vec4(color(CYAN).mul(halo).mul(1.1), 1)
  material.mrtNode = mrt({ glow: vec4(color(CYAN).mul(halo).mul(2.4), 1) })
  material.name = 'monolith-motes'
  const mesh = new Mesh(geometry, material)
  mesh.frustumCulled = false
  return mesh
}
