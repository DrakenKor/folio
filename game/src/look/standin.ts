// Placeholder figures for judging readability on the look page only: a hero
// in a red cloak, a violet enemy and a glowing projectile between them. The
// real characters come from render/characters (T0.6).
import { ConeGeometry, CylinderGeometry, Group, Mesh, PlaneGeometry, SphereGeometry, DoubleSide, type BufferGeometry } from 'three/webgpu'
import { color, faceDirection, mrt, positionLocal, sin, cos, transformNormalToView, vec3, vec4 } from 'three/tsl'
import { CelMaterial } from '../render/materials/cel'
import type { Environment } from '../render/materials/environment'
import type { Heightfield } from '../render/terrain/heightfield'

export function createStandIns(env: Environment, field: Heightfield, enemyAt: { x: number; z: number }) {
  const group = new Group()
  group.name = 'stand-ins'
  const hero = createHero(env)
  const { x, z } = field.player
  hero.position.set(x, field.heightAt(x, z), z)
  hero.rotation.y = Math.atan2(enemyAt.x - x, enemyAt.z - z)
  group.add(hero)

  const enemy = createEnemy(env)
  enemy.position.set(enemyAt.x, field.heightAt(enemyAt.x, enemyAt.z), enemyAt.z)
  enemy.rotation.y = Math.atan2(x - enemyAt.x, z - enemyAt.z)
  group.add(enemy)

  const glow = color('#ffb347').mul(3.2)
  const orbMaterial = new CelMaterial(env, { color: 0xfff1c9, emissiveNode: glow, outlineColor: vec3(0.35, 0.12, 0.02), outlineWidth: 0.8 })
  orbMaterial.mrtNode = mrt({ glow: vec4(glow, 1) })
  const orbs: Mesh[] = []
  for (let i = 0; i < 4; i++) {
    const orb = new Mesh(new SphereGeometry(0.15 * (1 - i * 0.22), 16, 12), orbMaterial)
    group.add(orb)
    orbs.push(orb)
  }

  const from = { x: x + Math.sin(hero.rotation.y) * 0.5, y: hero.position.y + 1.1, z: z + Math.cos(hero.rotation.y) * 0.5 }
  const to = { x: enemyAt.x, y: enemy.position.y + 0.45, z: enemyAt.z }
  return {
    group,
    update(time: number) {
      const t = (time * 0.7) % 1
      orbs.forEach((orb, i) => {
        const k = Math.max(0, t - i * 0.05)
        orb.position.set(from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k + Math.sin(k * Math.PI) * 0.35, from.z + (to.z - from.z) * k)
        orb.visible = k > 0.02 && k < 0.97
      })
      enemy.position.y = field.heightAt(enemyAt.x, enemyAt.z) + Math.abs(Math.sin(time * 2.4)) * 0.06
    }
  }
}

function part(geometry: BufferGeometry, material: CelMaterial, y: number): Mesh {
  const mesh = new Mesh(geometry, material)
  mesh.position.y = y
  mesh.castShadow = true
  return mesh
}

function createHero(env: Environment): Group {
  const hero = new Group()
  const ink = vec3(0.12, 0.03, 0.03)
  const cloak = new CelMaterial(env, { color: 0xc8392a, outlineColor: ink, outlineWidth: 1 })
  const cream = new CelMaterial(env, { color: 0xeee1c4, outlineColor: vec3(0.16, 0.12, 0.08), outlineWidth: 1 })
  const skin = new CelMaterial(env, { color: 0xf1c7a1, outlineColor: vec3(0.2, 0.1, 0.06), outlineWidth: 1 })
  const wood = new CelMaterial(env, { color: 0x6b4630, outlineColor: vec3(0.1, 0.05, 0.03), outlineWidth: 0.8 })
  hero.add(part(new CylinderGeometry(0.17, 0.44, 1.0, 12), cloak, 0.52))
  hero.add(part(new SphereGeometry(0.2, 16, 10), cream, 1.06))
  hero.add(part(new SphereGeometry(0.17, 16, 12), skin, 1.3))
  const hood = part(new SphereGeometry(0.2, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), cloak, 1.33)
  hood.rotation.x = -0.25
  hero.add(hood)
  const staff = part(new CylinderGeometry(0.025, 0.03, 1.6, 6), wood, 0.8)
  staff.position.set(0.36, 0.8, 0.08)
  staff.rotation.z = -0.08
  hero.add(staff)
  const tipGlow = color('#ffb347').mul(2.4)
  const tipMaterial = new CelMaterial(env, { color: 0xfff0c0, emissiveNode: tipGlow, outlineColor: vec3(0.3, 0.12, 0.03), outlineWidth: 0.8 })
  tipMaterial.mrtNode = mrt({ glow: vec4(tipGlow, 1) })
  const tip = part(new SphereGeometry(0.07, 12, 8), tipMaterial, 1.62)
  tip.position.x = 0.42
  hero.add(tip)

  // A scarf streaming behind, rippling in the wind.
  const scarfGeo = new PlaneGeometry(0.55, 0.12, 10, 1)
  scarfGeo.translate(0.275, 0, 0)
  const u = positionLocal.x.div(0.55)
  const wave = positionLocal.x.mul(9).sub(env.time.mul(9))
  const amp = u.mul(0.09).mul(env.windStrength.mul(0.5).add(0.5))
  const scarf = new CelMaterial(env, {
    color: 0xe3b341,
    side: DoubleSide,
    outlineColor: null,
    positionNode: vec3(positionLocal.x, positionLocal.y.sub(u.mul(u).mul(0.12)), positionLocal.z.add(sin(wave).mul(amp))),
    normalNode: transformNormalToView(vec3(cos(wave).mul(amp).mul(-9), 0, 1).normalize()).mul(faceDirection)
  })
  const scarfMesh = new Mesh(scarfGeo, scarf)
  scarfMesh.position.set(0, 1.12, -0.16)
  scarfMesh.rotation.y = Math.PI / 2 + 0.4
  hero.add(scarfMesh)
  return hero
}

/** Low folded shell, overlapping triangular scales and a forward ivory gaze. */
export function createEnemy(env: Environment): Group {
  const enemy = new Group()
  enemy.name = 'creaseback'
  const body = new CelMaterial(env, { color: 0x654273, readability: true })
  const shell = new CelMaterial(env, { color: 0x956a9e, flatShading: true, readability: true })
  const foot = new CelMaterial(env, { color: 0x493952, readability: true })
  const dome = part(new SphereGeometry(0.5, 16, 10), body, 0.36)
  dome.scale.set(1, 0.62, 1.25)
  enemy.add(dome)
  for (const side of [-1, 1]) for (const z of [-0.32, 0.25]) {
    const leg = part(new ConeGeometry(0.13, 0.22, 3), foot, 0.12)
    leg.position.set(side * 0.38, 0.12, z)
    leg.rotation.z = side * -0.4
    enemy.add(leg)
  }
  for (let row = 0; row < 3; row++) for (const side of [-1, 1]) {
    const scale = part(new ConeGeometry(0.24, 0.32, 3), shell, 0.65)
    scale.position.set(side * 0.2, 0.62 - row * 0.025, 0.22 - row * 0.27)
    scale.rotation.set(-0.35, side * 0.3, side * -0.48)
    scale.scale.set(1, 1, 0.65)
    enemy.add(scale)
  }
  const eyeMaterial = new CelMaterial(env, { color: 0xe8d8ae, outlineColor: null, readability: true })
  for (const side of [-1, 1]) {
    const eye = part(new SphereGeometry(0.045, 8, 6), eyeMaterial, 0.4)
    eye.scale.set(1.3, 0.65, 0.7)
    eye.position.set(side * 0.18, 0.4, 0.58)
    enemy.add(eye)
  }
  return enemy
}
