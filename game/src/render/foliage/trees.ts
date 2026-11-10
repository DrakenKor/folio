// About thirty procedural trees: round broadleaves built from clustered lumpy
// blobs, and a few tiered conifers for silhouette variety. Canopy normals are
// bent towards the canopy centre so each crown shades as one soft shape.
// Everything merges into two meshes (trunks, canopies) that sway in the wind.
import { ConeGeometry, CylinderGeometry, IcosahedronGeometry, Matrix4, Mesh, Quaternion, Vector3, type BufferGeometry, type Node } from 'three/webgpu'
import { attribute, cameraViewMatrix, cos, float, Fn, mix, positionLocal, sin, texture, vec2, vec3, vec4 } from 'three/tsl'
import { GeometryBuilder, linearColor } from '../geometry'
import { CelMaterial } from '../materials/cel'
import { triplanarNoise, type Environment } from '../materials/environment'
import { gustAt } from '../materials/wind'
import { Noise2D, rng, subSeed } from '../rng'
import { distanceToLine, type Heightfield } from '../terrain/heightfield'

export interface TreeSite {
  x: number
  z: number
  /** Canopy radius, for keeping other props clear. */
  radius: number
}

const BROADLEAF = ['#5e9c3f', '#7aa63c', '#4f8f45', '#8aab3f']
const CONIFER = ['#2f6d4f', '#3b7a52', '#2a6247']

export function createTrees(env: Environment, field: Heightfield) {
  const random = rng(subSeed(field.seed, 'trees'))
  const noise = new Noise2D(subSeed(field.seed, 'tree-shape'))
  const sites = placeTrees(field, random)

  const trunks = new GeometryBuilder()
  const canopies = new GeometryBuilder()
  const m = new Matrix4()
  const q = new Quaternion()
  const up = new Vector3(0, 1, 0)

  sites.forEach((site, i) => {
    const conifer = site.radius < 1.9
    const groundY = field.heightAt(site.x, site.z)
    const phase = random() * Math.PI * 2
    const trunkHeight = conifer ? 1.4 + random() * 0.6 : 2.2 + random() * 1.3
    const crownHeight = conifer ? 5.5 + random() * 2.5 : site.radius * 2.1
    const treeHeight = trunkHeight + crownHeight
    const sway = (p: Vector3) => ({ sway: [site.x, site.z, Math.max(0, p.y - groundY) / treeHeight, phase] })

    // Trunk: a tapered, slightly leaning cylinder.
    const trunkRadius = conifer ? 0.2 : 0.2 + site.radius * 0.04
    const trunk = new CylinderGeometry(trunkRadius * 0.6, trunkRadius, trunkHeight + 0.6, 7, 3)
    const lean = new Vector3(random() - 0.5, 4, random() - 0.5).normalize()
    q.setFromUnitVectors(up, lean)
    m.compose(new Vector3(site.x, groundY + (trunkHeight + 0.6) / 2 - 0.3, site.z), q, new Vector3(1, 1, 1))
    trunks.add(trunk, m, { color: linearColor('#6e4c36'), vertex: sway })
    const top = new Vector3(site.x, groundY + trunkHeight, site.z).addScaledVector(lean, 0.3)

    const tint = conifer ? CONIFER[i % CONIFER.length]! : BROADLEAF[i % BROADLEAF.length]!
    const color = linearColor(tint, 0.92 + random() * 0.16)

    if (conifer) {
      const tiers = 4
      for (let t = 0; t < tiers; t++) {
        const f = t / tiers
        const radius = site.radius * 1.5 * (1 - f * 0.62)
        const height = (crownHeight / tiers) * 1.55
        const cone = jaggedCone(radius, height, noise, i * 7 + t)
        m.compose(new Vector3(top.x, top.y - 0.4 + f * crownHeight * 0.82 + height / 2, top.z), q.identity(), new Vector3(1, 1, 1))
        const centre = new Vector3(top.x, top.y + crownHeight * 0.45, top.z)
        canopies.add(cone, m, {
          color,
          vertex: (p, n) => ({
            ...sway(p),
            soft: softNormal(n, p, centre, 0.45),
            hull: [n.x, n.y, n.z]
          })
        })
      }
    } else {
      const centre = new Vector3(top.x, top.y + site.radius * 0.9, top.z)
      const blobs: Array<[Vector3, number]> = [[centre.clone().add(new Vector3(0, site.radius * 0.25, 0)), site.radius]]
      const count = 3 + Math.floor(random() * 3)
      for (let b = 0; b < count; b++) {
        const a = (b / count) * Math.PI * 2 + random() * 0.8
        const r = site.radius * (0.55 + random() * 0.2)
        const off = site.radius * (0.55 + random() * 0.25)
        blobs.push([centre.clone().add(new Vector3(Math.cos(a) * off, -site.radius * (0.1 + random() * 0.3), Math.sin(a) * off)), r])
      }
      for (const [c, r] of blobs) {
        const blob = lumpyBlob(r, noise, c)
        m.makeTranslation(c.x, c.y, c.z)
        canopies.add(blob, m, {
          color,
          vertex: (p, n) => ({
            ...sway(p),
            soft: softNormal(n, p, centre, 0.62),
            hull: [n.x, n.y, n.z]
          })
        })
      }
    }
  })

  // Sway: the whole tree bends downwind with the shared gusts; leaves flutter.
  const swayData = attribute('sway', 'vec4')
  const swayNode = (flutter: number) =>
    Fn(() => {
      const base = vec2(swayData.x, swayData.y)
      const h = swayData.z
      const gust = gustAt(env, base)
      const phase = swayData.w
      const bend = env.windStrength.mul(gust.mul(0.35).add(0.1)).add(sin(env.time.mul(1.1).add(phase)).mul(0.06))
      const along = bend.mul(h.mul(h)).mul(1.6)
      const side = sin(env.time.mul(0.8).add(phase.mul(1.7))).mul(0.12).mul(h.mul(h)).mul(env.windStrength)
      const wind = env.windDirection
      let offset: Node<'vec3'> = vec3(wind.x.mul(along).sub(wind.y.mul(side)), along.mul(-0.15), wind.y.mul(along).add(wind.x.mul(side)))
      if (flutter > 0) {
        const p = positionLocal
        const wobble = sin(env.time.mul(4.2).add(p.x.mul(1.7)).add(p.y.mul(2.3)).add(phase))
          .mul(cos(env.time.mul(3.1).add(p.z.mul(1.9))))
          .mul(flutter)
          .mul(h)
          .mul(env.windStrength.mul(0.7).add(0.3))
        offset = offset.add(vec3(wobble, wobble.mul(0.5), wobble.mul(-0.7)))
      }
      return positionLocal.add(offset)
    })()

  const vertexColor = attribute('color', 'vec3')
  const trunkMaterial = new CelMaterial(env, {
    colorNode: vertexColor,
    positionNode: swayNode(0),
    outlineColor: vec3(0.11, 0.06, 0.05),
    outlineWidth: 0.9
  })
  trunkMaterial.name = 'trunk'

  const soft = attribute('soft', 'vec3')
  const leafNoise = triplanarNoise(env, positionLocal, soft, 0.055)
  const canopyMaterial = new CelMaterial(env, {
    colorNode: vertexColor.mul(mix(float(0.9), float(1.1), texture(env.noise, positionLocal.xz.mul(0.05)).g)),
    positionNode: swayNode(0.035),
    // The merged mesh sits at the origin, so its attributes are in world space.
    normalNode: cameraViewMatrix.mul(vec4(soft, 0)).xyz.normalize(),
    outlineColor: vertexColor.mul(0.32).add(vec3(0.0, 0.012, 0.03)),
    outlineNormal: attribute('hull', 'vec3'),
    outlineWidth: 1.1,
    bandOffset: leafNoise.sub(0.5).mul(0.28)
  })
  canopyMaterial.name = 'canopy'

  const trunkMesh = new Mesh(trunks.build(), trunkMaterial)
  trunkMesh.name = 'tree-trunks'
  const canopyMesh = new Mesh(canopies.build(), canopyMaterial)
  canopyMesh.name = 'tree-canopies'
  trunkMesh.castShadow = trunkMesh.receiveShadow = true
  // Crowns cast but do not receive: their bent normals already shade the big
  // shape, and lumpy self-shadowing only adds acne.
  canopyMesh.castShadow = true
  return { trunks: trunkMesh, canopies: canopyMesh, sites }
}

/** Blend of the surface normal and the direction from the crown's centre. */
function softNormal(n: Vector3, p: Vector3, centre: Vector3, amount: number): number[] {
  const d = p.clone().sub(centre).normalize()
  const s = n.clone().lerp(d, amount).normalize()
  return [s.x, s.y, s.z]
}

function lumpyBlob(radius: number, noise: Noise2D, centre: Vector3): BufferGeometry {
  const g = new IcosahedronGeometry(radius, 3)
  const pos = g.attributes.position!
  const v = new Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const d = v.clone().normalize()
    const n = noise.sample(d.x * 2.2 + centre.x, d.y * 2.2 + d.z * 1.7 + centre.z) * 0.14 + noise.sample(d.x * 5 + d.z * 3, d.y * 5 + centre.x) * 0.05
    // Flatten the underside a little, like a real crown.
    const squash = d.y < 0 ? 1 + d.y * 0.25 : 1
    v.copy(d).multiplyScalar(radius * (1 + n) * squash)
    pos.setXYZ(i, v.x, v.y, v.z)
  }
  // IcosahedronGeometry is non-indexed with duplicated vertices; normals from
  // positions keep the blob smooth.
  const nor = g.attributes.normal!
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize()
    nor.setXYZ(i, v.x, v.y, v.z)
  }
  return g
}

function jaggedCone(radius: number, height: number, noise: Noise2D, seed: number): BufferGeometry {
  const g = new ConeGeometry(radius, height, 14, 3, false)
  const pos = g.attributes.position!
  const v = new Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const a = Math.atan2(v.z, v.x)
    const rim = v.y < -height / 2 + 0.01 ? 1 : 0
    const zig = rim ? 1 + 0.18 * Math.sign(Math.sin(a * 7)) + noise.sample(a * 2 + seed, seed) * 0.1 : 1 + noise.sample(a * 2 + seed, v.y) * 0.06
    pos.setXYZ(i, v.x * zig, v.y - rim * Math.abs(Math.sin(a * 7)) * 0.25, v.z * zig)
  }
  g.computeVertexNormals()
  return g
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
