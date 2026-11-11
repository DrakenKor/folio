import { BufferAttribute, BufferGeometry, Group, Matrix4, Mesh } from 'three/webgpu'
import { attribute, uniform } from 'three/tsl'
import type { Entity } from '../../sim/core/types'
import { GeometryBuilder, linearColor } from '../geometry'
import { CelMaterial } from '../materials/cel'
import type { Environment } from '../materials/environment'

type Point = [number, number, number]

/** A tapered hexagonal fold with broad shoulders and a continuous raised spine. */
function fold(width: number, length: number, height: number, ridge = false): BufferGeometry {
  const vertices: Point[] = [[-width * 0.48, 0, -length], [width * 0.48, 0, -length],
    [width, 0, -length * 0.12], [width * 0.18, 0, length], [-width * 0.18, 0, length],
    [-width, 0, -length * 0.12], [0, height, -length * 0.35], [0, ridge ? 0 : height * 0.7, length * 0.65]]
  const faces = [0, 6, 1, 1, 6, 2, 2, 6, 7, 2, 7, 3, 3, 7, 4, 4, 7, 5, 5, 7, 6, 5, 6, 0,
    0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 5]
  const geometry = new BufferGeometry().setAttribute('position', new BufferAttribute(new Float32Array(faces.flatMap(i => vertices[i]!)), 3))
  geometry.computeVertexNormals()
  return geometry
}

/** Broad low shoulders, one rear fold and a distinct head and tapered tail. */
export function createEnemy(env: Environment): Group {
  const enemy = new Group()
  enemy.name = 'creaseback'
  const fade = uniform(1)
  const material = new CelMaterial(env, { colorNode: attribute('color', 'vec3'), readability: true,
    transparent: true, opacityNode: fade, flatShading: true })
  const build = (name: string, parts: Array<{ size: Point; at: Point; color: string; ridge?: boolean }>) => {
    const builder = new GeometryBuilder()
    for (const { size, at, color, ridge } of parts) {
      const geometry = fold(...size, ridge)
      builder.add(geometry, new Matrix4().makeTranslation(...at), { color: linearColor(color) })
      geometry.dispose()
    }
    const mesh = new Mesh(builder.build(), material)
    mesh.name = name
    mesh.castShadow = mesh.receiveShadow = true
    enemy.add(mesh)
    return mesh
  }
  build('under-fold', [{ size: [0.34, 0.3, 0.2], at: [0, 0.08, 0], color: '#493952' },
    ...[-1, 1].flatMap(side => [-0.16, 0.16].map(z => ({ size: [0.075, 0.1, 0.12] as Point,
      at: [side * 0.31, 0.035, z] as Point, color: '#514157', ridge: true }))),
    { size: [0.15, 0.15, 0.13], at: [0, 0.1, -0.29], color: '#654273', ridge: true }])
  for (let i = 0; i < 2; i++) {
    const plate = build(`fold-${i}`, [{ size: [0.43 - i * 0.1, 0.26 - i * 0.05, 0.37 - i * 0.09],
      at: [0, 0, 0], color: ['#886493', '#6d4a7b'][i]! }])
    plate.position.set(0, 0.17 - i * 0.035, -0.015 - i * 0.18)
  }
  build('front', [{ size: [0.255, 0.17, 0.2], at: [0, 0.14, 0.27], color: '#795685' },
    ...[-1, 1].map(side => ({ size: [0.044, 0.035, 0.035] as Point,
      at: [side * 0.145, 0.29, 0.32] as Point, color: '#e8d8ae' }))])
  const fragments = build('death-fragments', Array.from({ length: 5 }, (_, i) => ({
    size: [0.045, 0.07, 0.085], at: [Math.cos(i * 2.4) * 0.5, 0.18 + i % 2 * 0.1, Math.sin(i * 2.4) * 0.5], color: i % 2 ? '#886493' : '#b397b6'
  })))
  fragments.visible = false
  enemy.userData.fade = fade
  return enemy
}

/** Pose from processed action/death ages, including immediately after restoring a snapshot. */
export function poseEnemy(enemy: Group, actor: Entity, windupTicks: number): void {
  const deathAge = actor.death?.ageTicks ?? 0
  const collapse = actor.death ? Math.min(1, deathAge / 16) : 0
  const windup = actor.ai?.phase === 'telegraph' ? Math.min(1, (actor.action?.ageTicks ?? 0) / Math.max(1, windupTicks)) : 0
  const size = actor.radius / 0.45
  enemy.scale.set(size, size * (1 - windup * 0.13), size)
  enemy.rotation.z = actor.death ? collapse * 0.18 : Math.sin(actor.gait.phase * Math.PI * 2) * Math.min(0.045, actor.gait.speed * 0.025)
  enemy.children.forEach((piece, i) => {
    if (piece.name.startsWith('fold-')) {
      const row = i - 1
      piece.position.y = (0.17 - row * 0.035) * (1 - collapse * 0.75)
      piece.rotation.x = collapse * (0.95 - row * 0.28)
      piece.rotation.z = collapse * (row % 2 ? -0.65 : 0.55)
    } else if (piece.name === 'front' || piece.name === 'under-fold') {
      piece.scale.y = 1 - collapse * 0.7
    } else if (piece.name === 'death-fragments') {
      piece.visible = actor.death !== null
      piece.scale.setScalar(0.35 + collapse * 0.9)
      piece.position.y = Math.sin(collapse * Math.PI) * 0.28
      piece.rotation.y = collapse * 0.7
    }
  })
  const duration = actor.death?.despawnAfterTicks ?? 30
  enemy.userData.fade.value = actor.death ? Math.min(1, Math.max(0, (duration - deathAge) / 12)) : 1
  enemy.traverse(node => { if (node instanceof Mesh) node.castShadow = !actor.death || deathAge < 18 })
}
