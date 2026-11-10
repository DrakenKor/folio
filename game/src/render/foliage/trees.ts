// Smooth clumps and tiered pines share cel lighting and the travelling meadow gust.
import { CylinderGeometry, LatheGeometry, Matrix4, Mesh, Quaternion, SphereGeometry, Vector2, Vector3 } from 'three/webgpu'
import { attribute, Fn, positionLocal, sin, vec2, vec3 } from 'three/tsl'
import { GeometryBuilder, linearColor } from '../geometry'
import { CelMaterial } from '../materials/cel'
import type { Environment } from '../materials/environment'
import { gustAt } from '../materials/wind'
import { rng, subSeed } from '../rng'
import { distanceToLine, type Heightfield } from '../terrain/heightfield'

export interface TreeSite {
  x: number
  z: number
  /** Canopy radius, for keeping other props clear. */
  radius: number
}

const BROADLEAF = ['#659444', '#789c48', '#568d50', '#889e4b']
const CONIFER = ['#52805a', '#60895c', '#4c7959']

export function createTrees(env: Environment, field: Heightfield) {
  const random = rng(subSeed(field.seed, 'trees'))
  const sites = placeTrees(field, random)
  const trunks = new GeometryBuilder()
  const canopies = new GeometryBuilder()
  const sphere = new SphereGeometry(1, 48, 32)
  const matrix = new Matrix4()
  const rotation = new Quaternion()
  const up = new Vector3(0, 1, 0)

  sites.forEach((site, i) => {
    const conifer = site.radius < 1.9
    const ground = field.heightAt(site.x, site.z)
    const phase = random() * Math.PI * 2
    const variant = i % 4
    const lean = new Vector3((random() - 0.35) * 0.22, 0, (random() - 0.5) * 0.18)
    const trunkHeight = conifer ? 2.1 : (variant === 1 ? 3.6 : 2.5) + random() * 0.6
    const crownHeight = conifer ? 5.8 + random() * 1.6 : site.radius * 2.3
    const treeHeight = trunkHeight + crownHeight
    const sway = (p: Vector3, offset = 0) => ({
      sway: [site.x, site.z, Math.max(0, p.y - ground) / treeHeight, phase + offset]
    })
    const radius = conifer ? 0.25 : 0.28 + site.radius * 0.045
    const trunk = new LatheGeometry([
      new Vector2(radius * 1.85, -0.25),
      new Vector2(radius * 1.55, 0.12),
      new Vector2(radius, 0.65),
      new Vector2(radius * 0.78, trunkHeight * 0.65),
      new Vector2(radius * 0.42, trunkHeight + site.radius * 0.7)
    ], 20)
    matrix.set(1, lean.x, 0, site.x, 0, 1, 0, ground, 0, lean.z, 1, site.z, 0, 0, 0, 1)
    trunks.add(trunk, matrix, { color: linearColor('#78543b'), vertex: p => sway(p) })
    trunk.dispose()

    const tint = conifer ? CONIFER[i % CONIFER.length]! : BROADLEAF[i % BROADLEAF.length]!
    if (conifer) {
      for (let tier = 0; tier < 4; tier++) {
        const f = tier / 4
        const r = site.radius * 1.45 * (1 - f * 0.78)
        const height = crownHeight * (0.46 - f * 0.05)
        const cone = new LatheGeometry([
          new Vector2(0, 0), new Vector2(r * 0.78, 0.02 * height),
          new Vector2(r, 0.09 * height), new Vector2(r * 0.94, 0.18 * height),
          new Vector2(r * 0.64, 0.45 * height), new Vector2(r * 0.31, 0.76 * height),
          new Vector2(0.035, height)
        ], 48)
        matrix.makeTranslation(site.x, ground + trunkHeight - 0.65 + f * crownHeight * 0.84, site.z)
        canopies.add(cone, matrix, {
          color: linearColor(tint, 0.96 + tier * 0.045),
          vertex: p => sway(p, tier * 0.25)
        })
        cone.dispose()
      }
    } else {
      const tall = variant === 1
      const spread = variant === 2
      const swept = variant === 3
      const centre = new Vector3(site.x, ground + trunkHeight + site.radius * 0.65, site.z)
        .addScaledVector(lean, trunkHeight)
      const count = [4, 3, 5, 3][variant]!
      const angle = random() * Math.PI * 2
      const clumps: Array<{ centre: Vector3; radius: number; stretch: Vector3 }> = []
      if (tall) clumps.push({ centre: centre.clone().add(new Vector3(0, site.radius * 0.65, 0)), radius: site.radius * 0.72, stretch: new Vector3(0.95, 1.5, 0.95) })
      for (let b = 0; b < count; b++) {
        const a = angle + b / count * Math.PI * 2
        const reach = site.radius * (spread ? 0.72 : tall ? 0.30 : 0.50)
        const c = centre.clone().add(new Vector3(
          Math.cos(a) * reach + (swept ? b * site.radius * 0.25 : 0),
          tall ? b * site.radius * 0.62 : site.radius * (b === 0 ? 0.55 : -0.12 + random() * 0.28),
          Math.sin(a) * reach
        ))
        const r = site.radius * (tall ? 0.58 : spread ? 0.65 : 0.75) * (0.88 + random() * 0.22)
        clumps.push({ centre: c, radius: r, stretch: new Vector3(spread ? 1.2 : 1, tall ? 1.2 : swept ? 0.72 : 0.94, 0.88 + random() * 0.18) })
        if (b < 3) {
          const start = new Vector3(site.x, ground + trunkHeight * 0.65, site.z).addScaledVector(lean, trunkHeight * 0.65)
          const end = c.clone().add(new Vector3(0, -r * 0.4, 0))
          const branch = new CylinderGeometry(radius * 0.20, radius * 0.55, start.distanceTo(end), 12)
          rotation.setFromUnitVectors(up, end.clone().sub(start).normalize())
          matrix.compose(start.add(end).multiplyScalar(0.5), rotation, new Vector3(1, 1, 1))
          trunks.add(branch, matrix, { color: linearColor('#78543b'), vertex: p => sway(p) })
          branch.dispose()
        }
      }
      clumps.forEach((clump, b) => {
        rotation.setFromAxisAngle(up, angle + b * 0.8)
        matrix.compose(clump.centre, rotation, clump.stretch.multiplyScalar(clump.radius))
        canopies.add(sphere, matrix, {
          color: linearColor(tint, 0.97 + random() * 0.06),
          vertex: p => sway(p, b * 0.3)
        })
      })
    }
  })
  sphere.dispose()

  const data = attribute('sway', 'vec4')
  const swayNode = (canopy: boolean) => Fn(() => {
    const anchor = vec2(data.x, data.y)
    const gust = gustAt(env, anchor.add(env.windDirection.mul(1.8))).toVar()
    const h = data.z.mul(data.z)
    const phase = env.time.mul(1.2).sub(anchor.dot(env.windDirection).mul(0.20))
    const along = gust.mul(0.88).add(0.08).add(sin(phase).mul(0.08))
      .mul(h).mul(env.windStrength)
    const side = sin(phase.mul(0.8)).mul(0.035)
      .add(sin(env.time.mul(2).add(data.w)).mul(canopy ? 0.018 : 0))
      .mul(gust.mul(0.6).add(0.4)).mul(h).mul(env.windStrength)
    const wind = env.windDirection
    return positionLocal.add(vec3(
      wind.x.mul(along).sub(wind.y.mul(side)),
      along.mul(-0.08),
      wind.y.mul(along).add(wind.x.mul(side))
    ))
  })()

  const vertexColor = attribute('color', 'vec3')
  const trunkMaterial = new CelMaterial(env, { colorNode: vertexColor, positionNode: swayNode(false) })
  trunkMaterial.name = 'trunk'
  const canopyMaterial = new CelMaterial(env, {
    colorNode: vertexColor,
    positionNode: swayNode(true),
    bandOffset: null,
    outlineWidth: 0.7
  })
  canopyMaterial.name = 'canopy'
  const trunkMesh = new Mesh(trunks.build(), trunkMaterial)
  const canopyMesh = new Mesh(canopies.build(), canopyMaterial)
  trunkMesh.name = 'tree-trunks'
  canopyMesh.name = 'tree-canopies'
  trunkMesh.castShadow = trunkMesh.receiveShadow = true
  canopyMesh.castShadow = canopyMesh.receiveShadow = true
  return { trunks: trunkMesh, canopies: canopyMesh, sites }
}

function placeTrees(field: Heightfield, random: () => number): TreeSite[] {
  const { player, monolith } = field
  const sites: TreeSite[] = []
  const ok = (x: number, z: number, r: number) =>
    Math.abs(x) < 112 &&
    Math.abs(z) < 112 &&
    distanceToLine(field.pathLine, x, z) > r + 2.2 &&
    Math.hypot(x - monolith.x, z - monolith.z) > r + 9 &&
    Math.hypot(x - player.x, z - player.z) > r + 5 &&
    sites.every(s => Math.hypot(s.x - x, s.z - z) > (s.radius + r) * 0.9)

  // Anchors frame the bookmarks: a tree beside the player, a grove behind the monolith.
  const anchors: Array<[number, number, number]> = [
    [player.x + 8.6, player.z - 5.5, 2.3],
    [player.x - 8.5, player.z - 3.4, 2.4],
    [player.x - 28.5, player.z + 27, 2.8],
    [player.x + 12, player.z - 13, 1.6],
    [monolith.x + 11, monolith.z - 9, 2.6],
    [monolith.x + 4, monolith.z - 16, 1.5],
    [monolith.x - 6, monolith.z - 15, 2.2],
    [monolith.x + 16, monolith.z + 2, 1.4]
  ]
  for (const [x, z, r] of anchors) if (ok(x, z, r)) sites.push({ x, z, radius: r })

  const groves = 7
  for (let g = 0; g < groves && sites.length < 32; g++) {
    let cx = 0
    let cz = 0
    for (let tries = 0; tries < 40; tries++) {
      cx = (random() * 2 - 1) * 95
      cz = (random() * 2 - 1) * 95
      if (ok(cx, cz, 3)) break
    }
    const members = 2 + Math.floor(random() * 4)
    for (let k = 0; k < members * 6 && sites.length < 32; k++) {
      const a = random() * Math.PI * 2
      const d = 2 + random() * 11
      const conifer = random() < 0.3
      const r = conifer ? 1.3 + random() * 0.5 : 2 + random() * 0.9
      const x = cx + Math.cos(a) * d
      const z = cz + Math.sin(a) * d
      if (ok(x, z, r)) sites.push({ x, z, radius: r })
      if (sites.filter(s => Math.hypot(s.x - cx, s.z - cz) < 16).length >= members) break
    }
  }
  return sites
}
