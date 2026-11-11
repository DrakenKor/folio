import { Box3, Color, DirectionalLight, GridHelper, HemisphereLight, Mesh, NeutralToneMapping,
  PCFShadowMap, PerspectiveCamera, PlaneGeometry, Scene, WebGPURenderer } from 'three/webgpu'
import { CharacterView, loadCharacter, type CharacterAsset } from './character'
import { CelMaterial } from '../materials/cel'
import { createEnvironment } from '../materials/environment'
import { installSmoothShadows } from '../materials/shadow'
import { createPost } from '../post/pipeline'
import { previewLength, previewState } from '../../anim/preview'
import { CLIP_MARKERS, CLIP_NAMES, type ClipName } from './markers'

/** Twelve ages include exact phase boundaries, contact and the terminal sample. */
export function sheetAges(clip: ClipName): number[] {
  if (clip === 'death') return [0, 4, 8, 12, 16, 24, 28, 32, 34, 38, 44, 48]
  const timing = previewState(clip, 0).timing
  if (!timing) return Array.from({ length: 12 }, (_, i) => i / 11 * previewLength(clip))
  const { windupTicks: w, activeTicks: a, recoveryTicks: r } = timing
  if (w === 0) return [0, a / 6, a / 3, a / 2, a * 2 / 3, a,
    a + r / 6, a + r / 3, a + r / 2, a + r * 2 / 3, a + r - 1, a + r]
  return [0, w / 2, Math.max(0, w - 1), w, w + a / 2, w + a,
    w + a + r / 6, w + a + r / 3, w + a + r / 2, w + a + r * 2 / 3, w + a + r - 1, w + a + r]
}

/** Twelve fixed samples moving over a quarter-metre grid, for judging silhouette and foot contact. */
export async function renderCharacterSheet(asset: CharacterAsset | undefined, clip: string, forceWebGL: boolean): Promise<string> {
  if (!CLIP_NAMES.includes(clip as ClipName)) throw new Error(`unknown clip ${clip}`)
  const name = clip as ClipName
  const canvas = document.createElement('canvas')
  const renderer = new WebGPURenderer({ canvas, antialias: true, forceWebGL })
  await renderer.init()
  renderer.toneMapping = NeutralToneMapping
  const env = createEnvironment(7)
  const character = new CharacterView(asset ?? await loadCharacter(`${import.meta.env.BASE_URL}pack/characters/knight.glb`), { env })
  const scene = new Scene()
  let post: ReturnType<typeof createPost> | undefined
  try {
    const duration = CLIP_MARKERS[name].end
    const gait = clip === 'walk' ? character.walk : clip === 'run' ? character.run : null
    const speed = gait?.speed ?? 0
    const travel = speed * duration
    const ages = sheetAges(name)
    const bounds = new Box3()
    for (const age of ages) {
      character.object.position.set(speed * age / 60, 0, 0)
      character.poseActor(previewState(name, age))
      bounds.union(new Box3().setFromObject(character.object, true))
    }
    const height = Math.max(2.4, bounds.max.y - bounds.min.y + 0.5)
    const width = Math.max(2.4, bounds.max.x - bounds.min.x + 0.6)
    const cellHeight = 320
    const cellWidth = Math.ceil(cellHeight * width / height)
    renderer.setPixelRatio(1)
    renderer.setSize(cellWidth, cellHeight, false)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = PCFShadowMap
    scene.background = new Color(0xc9d3d6)
    scene.add(new HemisphereLight(env.palette.skyFill, env.palette.groundFill, 2))
    const sun = new DirectionalLight(env.palette.sun, 3)
    const centre = travel / 2 + 0.3
    sun.position.set(centre - 5, 10, 7)
    sun.target.position.set(centre, 0, 0)
    env.sunDirection.value.copy(sun.position).sub(sun.target.position).normalize()
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.left = sun.shadow.camera.bottom = -8
    sun.shadow.camera.right = sun.shadow.camera.top = 8
    sun.shadow.normalBias = 0.02
    installSmoothShadows(sun.shadow)
    scene.add(sun, sun.target, character.object)
    const plane = new Mesh(new PlaneGeometry(80, 80), new CelMaterial(env, { color: 0x9aa392, outlineColor: null }))
    plane.rotation.x = -Math.PI / 2
    plane.receiveShadow = true
    const minor = new GridHelper(80, 320, 0x8a937f, 0x8a937f)
    const major = new GridHelper(80, 80, 0x6c7563, 0x6c7563)
    minor.position.y = 0.002
    major.position.y = 0.003
    scene.add(plane, minor, major)
    const camera = new PerspectiveCamera(2 * Math.atan(height / 2 / 8) * 180 / Math.PI, cellWidth / cellHeight, 0.1, 200)
    const centreX = (bounds.max.x + bounds.min.x) / 2
    const centreY = (bounds.max.y + bounds.min.y) / 2
    camera.position.set(centreX, centreY + 0.5, 8)
    camera.lookAt(centreX, centreY, 0)
    post = createPost(renderer, scene, camera)
    const sheet = document.createElement('canvas')
    sheet.width = cellWidth * 4
    sheet.height = cellHeight * 3
    const context = sheet.getContext('2d')!
    context.font = '14px system-ui, sans-serif'
    for (let i = 0; i < 12; i++) {
      await new Promise(requestAnimationFrame)
      const age = ages[i]!
      const time = age / 60
      env.time.value = time
      character.object.position.set(speed * time, 0, 0)
      character.poseActor(previewState(name, age))
      post.render()
      const x = i % 4 * cellWidth
      const y = Math.floor(i / 4) * cellHeight
      context.drawImage(canvas, x, y)
      context.fillStyle = '#1a1c33'
      context.fillText(`${clip} #${i}  age=${age.toFixed(1)}${i === 11 ? ' end' : ''}`, x + 8, y + 18)
      context.strokeStyle = 'rgb(26 28 51 / 0.35)'
      context.strokeRect(x + 0.5, y + 0.5, cellWidth - 1, cellHeight - 1)
    }
    sun.shadow.dispose()
    minor.dispose()
    major.dispose()
    plane.geometry.dispose()
    plane.material.dispose()
    return sheet.toDataURL('image/png')
  } finally {
    character.dispose()
    post?.dispose()
    env.noise.dispose()
    await renderer.dispose()
  }
}
