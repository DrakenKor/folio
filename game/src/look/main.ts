// Dev-only look spike page: the meadow on fixed camera bookmarks.
//
// URL parameters: `?t=<seconds>` freezes scene time, `?backend=webgl` forces
// WebGL2, `?cam=wide|player|monolith` picks a bookmark, `?seed=<n>` the
// layout, `?panel=1` shows the sliders.
import { NeutralToneMapping, PCFShadowMap, PerspectiveCamera, WebGPURenderer } from 'three/webgpu'
import { createMeadow } from '../render/meadow'
import { createPost } from '../render/post/pipeline'
import { bookmark, type BookmarkName } from './bookmarks'
import { createPanel } from './panel'
import { createStandIns } from './standin'

interface PerfResult {
  median: number
  p95: number
  frames: number
  seconds: number
  backend: string
  width: number
  height: number
  pixelRatio: number
}

interface LookApi {
  ready: boolean
  backend: string
  perf(seconds: number): Promise<PerfResult>
  /** Dev handles for probing uniforms from the console. */
  debug?: Record<string, unknown>
}

declare global {
  interface Window {
    __look: LookApi
  }
}

const params = new URLSearchParams(location.search)
const seed = Number(params.get('seed') ?? 7)
const frozenAt = params.has('t') ? Number(params.get('t')) : null
const camName = (['wide', 'player', 'monolith'].includes(params.get('cam') ?? '') ? params.get('cam') : 'wide') as BookmarkName

const look: LookApi = { ready: false, backend: 'pending', perf: () => Promise.reject(new Error('not ready')) }
window.__look = look

const canvas = document.getElementById('stage') as HTMLCanvasElement
const renderer = new WebGPURenderer({ canvas, antialias: true, forceWebGL: params.get('backend') === 'webgl' })
await renderer.init()
renderer.shadowMap.enabled = true
renderer.shadowMap.type = PCFShadowMap
renderer.toneMapping = NeutralToneMapping
renderer.toneMappingExposure = 1
look.backend = (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend ? 'webgpu' : 'webgl2'

const meadow = createMeadow(seed)
const camera = new PerspectiveCamera(45, 1, 0.1, 4000)
const view = bookmark(camName, meadow.field)
camera.position.set(...view.position)
camera.lookAt(...view.target)
camera.fov = view.fov
meadow.grass.uniforms.cell.value = view.grassCell
meadow.setFocus(view.focus[0], view.focus[1], view.shadowExtent)
meadow.setPlayer(meadow.field.player.x, meadow.field.player.z)

const standIns = createStandIns(meadow.env, meadow.field, { x: meadow.field.player.x - 1.6, z: meadow.field.player.z - 3.4 })
meadow.scene.add(standIns.group)

const post = createPost(renderer, meadow.scene, camera)
look.debug = { meadow, post, camera, renderer }

function resize() {
  const ratio = Math.min(window.devicePixelRatio, 1.5)
  renderer.setPixelRatio(ratio)
  renderer.setSize(window.innerWidth, window.innerHeight, false)
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
}
window.addEventListener('resize', resize)
resize()

// Scene time: frozen at `?t`, otherwise running from zero. perf() runs it freely.
let running = frozenAt === null
let timeBase = frozenAt ?? 0
let runStart = performance.now()
const sceneTime = (now: number) => (running ? timeBase + (now - runStart) / 1000 : timeBase)

let onFrame: ((now: number) => void) | null = null
let framesDrawn = 0

renderer.setAnimationLoop((now: number) => {
  const t = sceneTime(now)
  meadow.update(t, camera)
  standIns.update(t)
  post.render()
  framesDrawn++
  if (framesDrawn === 8) look.ready = true
  onFrame?.(now)
})

look.perf = (seconds: number) =>
  new Promise<PerfResult>(resolve => {
    const wasRunning = running
    if (!wasRunning) {
      running = true
      runStart = performance.now()
    }
    const stamps: number[] = []
    onFrame = now => {
      stamps.push(now)
      if (now - stamps[0]! < seconds * 1000) return
      onFrame = null
      if (!wasRunning) {
        running = false
      }
      const deltas = stamps.slice(1).map((s, i) => s - stamps[i]!).sort((a, b) => a - b)
      const pick = (q: number) => deltas[Math.min(deltas.length - 1, Math.floor(q * deltas.length))]!
      resolve({
        median: round(pick(0.5)),
        p95: round(pick(0.95)),
        frames: deltas.length,
        seconds,
        backend: look.backend,
        width: canvas.width,
        height: canvas.height,
        pixelRatio: renderer.getPixelRatio()
      })
    }
  })

function round(x: number) {
  return Math.round(x * 100) / 100
}

const { env, sunSettings, grass } = meadow
createPanel(
  [
    {
      title: 'Light',
      sliders: [
        { label: 'Sun elevation', min: 3, max: 85, step: 1, get: () => sunSettings.elevation, set: v => ((sunSettings.elevation = v), meadow.applySun()) },
        { label: 'Sun azimuth', min: 0, max: 360, step: 1, get: () => sunSettings.azimuth, set: v => ((sunSettings.azimuth = v), meadow.applySun()) },
        { label: 'Sun intensity', min: 0, max: 6, step: 0.05, get: () => sunSettings.intensity, set: v => ((sunSettings.intensity = v), meadow.applySun()) },
        { label: 'Fill intensity', min: 0, max: 4, step: 0.05, get: () => sunSettings.fill, set: v => ((sunSettings.fill = v), meadow.applySun()) },
        { label: 'Band softness', min: 0.005, max: 0.25, step: 0.005, get: () => env.bands.softness.value, set: v => (env.bands.softness.value = v) },
        { label: 'Mid band level', min: 0, max: 1, step: 0.01, get: () => env.bands.mid.value, set: v => (env.bands.mid.value = v) }
      ]
    },
    {
      title: 'Haze',
      sliders: [
        { label: 'Density', min: 0, max: 0.012, step: 0.0001, get: () => env.hazeDensity.value, set: v => (env.hazeDensity.value = v) },
        { label: 'Start (m)', min: 0, max: 80, step: 1, get: () => env.hazeStart.value, set: v => (env.hazeStart.value = v) }
      ]
    },
    {
      title: 'Grass',
      sliders: [
        { label: 'Height', min: 0, max: 2, step: 0.01, get: () => grass.uniforms.height.value, set: v => (grass.uniforms.height.value = v) },
        { label: 'Density', min: 0, max: 1, step: 0.01, get: () => grass.uniforms.density.value, set: v => (grass.uniforms.density.value = v) },
        { label: 'Wind', min: 0, max: 2, step: 0.01, get: () => env.windStrength.value, set: v => (env.windStrength.value = v) },
        { label: 'Bend radius', min: 0, max: 4, step: 0.05, get: () => grass.uniforms.bendRadius.value, set: v => (grass.uniforms.bendRadius.value = v) },
        { label: 'Short radius', min: 0, max: 8, step: 0.1, get: () => grass.uniforms.shortenRadius.value, set: v => (grass.uniforms.shortenRadius.value = v) }
      ]
    },
    {
      title: 'Post',
      sliders: [
        { label: 'Outline px', min: 0, max: 5, step: 0.05, get: () => post.uniforms.outlineWidth.value, set: v => (post.uniforms.outlineWidth.value = v) },
        { label: 'Bloom', min: 0, max: 3, step: 0.01, get: () => post.uniforms.bloomStrength.value, set: v => (post.uniforms.bloomStrength.value = v) },
        { label: 'Saturation', min: 0, max: 2, step: 0.01, get: () => post.uniforms.saturation.value, set: v => (post.uniforms.saturation.value = v) }
      ]
    }
  ],
  params.get('panel') === '1'
)
