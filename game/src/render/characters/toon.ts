import {
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  DataTexture,
  LinearFilter,
  Mesh,
  MeshToonNodeMaterial,
  NodeMaterial,
  RedFormat,
  SkinnedMesh,
  type Material,
  type Object3D,
  type Texture
} from 'three/webgpu'
import {
  cameraProjectionMatrix,
  float,
  mix,
  modelViewMatrix,
  normalLocal,
  normalView,
  normalize,
  positionLocal,
  positionViewDirection,
  smoothstep,
  texture,
  uniform,
  vec2,
  vec3,
  vec4
} from 'three/tsl'

/** Outline width as a fraction of the viewport height. */
export const outlineWidth = uniform(0.0032)
/** Strength of the cool rim that lifts the silhouette off the ground. */
export const rimStrength = uniform(0.6)

const OUTLINE_TINT = new Color(0x1a1c33)

let ramp: DataTexture | null = null

/** Three soft bands: shadow, mid and lit, sampled by the toon lighting model at N·L. */
function toonRamp(): DataTexture {
  if (ramp) return ramp
  const size = 64
  const data = new Uint8Array(size)
  const band = (x: number, edge: number) => Math.min(1, Math.max(0, (x - edge) / 0.05 + 0.5))
  for (let i = 0; i < size; i++) {
    const x = i / (size - 1)
    data[i] = Math.round(255 * (0.42 + 0.3 * band(x, 0.46) + 0.28 * band(x, 0.64)))
  }
  ramp = new DataTexture(data, size, 1, RedFormat)
  ramp.magFilter = LinearFilter
  ramp.minFilter = LinearFilter
  ramp.needsUpdate = true
  return ramp
}

/** Averages normals across vertices that share a position, so the hull does not split at hard edges. */
function smoothNormals(geometry: BufferGeometry): BufferGeometry {
  const position = geometry.getAttribute('position')
  const normal = geometry.getAttribute('normal')
  const sums = new Map<string, [number, number, number]>()
  const keys: string[] = []
  for (let i = 0; i < position.count; i++) {
    const key = `${position.getX(i).toFixed(4)},${position.getY(i).toFixed(4)},${position.getZ(i).toFixed(4)}`
    keys.push(key)
    const sum = sums.get(key) ?? [0, 0, 0]
    sum[0] += normal.getX(i)
    sum[1] += normal.getY(i)
    sum[2] += normal.getZ(i)
    sums.set(key, sum)
  }
  const out = new Float32Array(position.count * 3)
  keys.forEach((key, i) => {
    const [x, y, z] = sums.get(key)!
    const length = Math.hypot(x, y, z) || 1
    out.set([x / length, y / length, z / length], i * 3)
  })
  const hull = new BufferGeometry()
  for (const [name, attribute] of Object.entries(geometry.attributes)) hull.setAttribute(name, attribute)
  hull.setAttribute('normal', new BufferAttribute(out, 3))
  hull.setIndex(geometry.index)
  return hull
}

/** Back-face hull pushed out along the normal in clip space, so the line keeps one width on screen. */
function outlineMaterial(map: Texture | null): NodeMaterial {
  const material = new NodeMaterial()
  material.side = BackSide
  const mvp = cameraProjectionMatrix.mul(modelViewMatrix)
  const clip = mvp.mul(vec4(positionLocal, 1))
  const direction = normalize(mvp.mul(vec4(normalLocal, 0)).xy)
  // P[0][0] / P[1][1] undoes the projection's aspect, so x and y offsets match in pixels.
  const aspect = cameraProjectionMatrix.mul(vec4(1, 0, 0, 0)).x.div(cameraProjectionMatrix.mul(vec4(0, 1, 0, 0)).y)
  const offset = direction.mul(vec2(aspect, 1)).mul(outlineWidth.mul(2)).mul(clip.w)
  material.vertexNode = vec4(clip.xy.add(offset), clip.z, clip.w)
  const albedo = map ? texture(map).rgb : vec3(0.5)
  material.colorNode = vec4(mix(albedo.mul(0.3), vec3(OUTLINE_TINT.r, OUTLINE_TINT.g, OUTLINE_TINT.b), 0.4), 1)
  return material
}

function toonMaterial(source: Material & { map?: Texture | null; color?: Color }): MeshToonNodeMaterial {
  const material = new MeshToonNodeMaterial({
    map: source.map ?? null,
    color: source.color ?? new Color(0xffffff),
    gradientMap: toonRamp(),
    side: source.side
  })
  material.name = source.name
  // A rim that brightens the surface colour, so thin parts seen edge-on stay their own hue.
  const albedo = source.map ? texture(source.map).rgb : vec3(1)
  const rim = smoothstep(0.7, 0.92, float(1).sub(normalView.dot(positionViewDirection).abs()))
  // Supported by NodeMaterial.setupLighting; the toon declaration omits this property.
  return Object.assign(material, { emissiveNode: albedo.mul(vec3(0.85, 0.92, 1)).mul(rim).mul(rimStrength) })
}

/** Replaces every mesh's material with the toon material and adds a tinted outline hull beside it. */
export function applyToon(root: Object3D): void {
  const meshes: Mesh[] = []
  root.traverse((node) => {
    if (node instanceof Mesh) meshes.push(node)
  })
  for (const mesh of meshes) {
    const source = mesh.material as Material & { map?: Texture | null }
    mesh.material = toonMaterial(source)
    mesh.castShadow = true
    const geometry = smoothNormals(mesh.geometry)
    const material = outlineMaterial(source.map ?? null)
    const hull = mesh instanceof SkinnedMesh ? new SkinnedMesh(geometry, material) : new Mesh(geometry, material)
    if (hull instanceof SkinnedMesh && mesh instanceof SkinnedMesh) hull.bind(mesh.skeleton, mesh.bindMatrix)
    hull.name = `${mesh.name}_outline`
    hull.position.copy(mesh.position)
    hull.quaternion.copy(mesh.quaternion)
    hull.scale.copy(mesh.scale)
    hull.frustumCulled = mesh.frustumCulled
    mesh.parent!.add(hull)
  }
}
