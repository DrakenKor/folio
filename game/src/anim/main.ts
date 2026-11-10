import {
  Color,
  DirectionalLight,
  GridHelper,
  Group,
  HemisphereLight,
  Mesh,
  MeshToonNodeMaterial,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  WebGPURenderer
} from 'three/webgpu'
import { CharacterView, loadCharacter } from '../render/characters/character'

// Dev-only character viewer.
//   ?clip=<name>&t=<seconds>  freeze one clip at a time
//   ?sheet=<clip>             render 12 frames of one loop into window.__anim.sheet
//   ?cam=side|game            side view, or three-quarter top-down at 15 m
//   ?speed= ?facing= ?character= ?backend=webgl
const params = new URLSearchParams(location.search)
const clipParam = params.get('clip')
const sheetParam = params.get('sheet')
const camMode = params.get('cam') ?? (sheetParam ? 'side' : 'game')
const SHEET = { cols: 4, rows: 3, cellHeight: 320 }
const GAME_PITCH = (55 * Math.PI) / 180
const GAME_DISTANCE = 15

const anim = { ready: false, clips: [] as readonly string[], sheet: null as string | null, backend: '', gaits: {}, view: null as CharacterView | null }
Object.assign(window, { __anim: anim })

const canvas = document.getElementById('stage') as HTMLCanvasElement
const renderer = new WebGPURenderer({ canvas, antialias: true, forceWebGL: params.get('backend') === 'webgl' })
renderer.shadowMap.enabled = true
renderer.shadowMap.type = PCFShadowMap
await renderer.init()
anim.backend = 'isWebGPUBackend' in renderer.backend ? 'webgpu' : 'webgl2'

const scene = new Scene()
scene.background = new Color(0xc9d3d6)
scene.add(new HemisphereLight(0xbcd4ff, 0x5c5346, 1.1))
const sun = new DirectionalLight(0xffe2b8, 2.6)
sun.position.set(-5, 10, 7)
sun.castShadow = true
sun.shadow.mapSize.set(2048, 2048)
sun.shadow.camera.left = sun.shadow.camera.bottom = -8
sun.shadow.camera.right = sun.shadow.camera.top = 8
sun.shadow.normalBias = 0.02
scene.add(sun, sun.target)

// Neutral ground with a 25 cm grid, so a planted foot can be checked against the lines.
const ground = new Group()
const plane = new Mesh(new PlaneGeometry(80, 80), new MeshToonNodeMaterial({ color: 0x9aa392 }))
plane.rotation.x = -Math.PI / 2
plane.receiveShadow = true
const minor = new GridHelper(80, 320, 0x8a937f, 0x8a937f)
const major = new GridHelper(80, 80, 0x6c7563, 0x6c7563)
minor.position.y = 0.002
major.position.y = 0.003
ground.add(plane, minor, major)
scene.add(ground)

const camera = new PerspectiveCamera(40, 1, 0.1, 200)

const characterId = params.get('character') ?? 'knight'
const view = new CharacterView(await loadCharacter(`${import.meta.env.BASE_URL}pack/characters/${characterId}.glb`))
scene.add(view.object)
anim.clips = view.clips
anim.gaits = { walk: view.walk, run: view.run }
anim.view = view

const facing = Number(params.get('facing') ?? (camMode === 'game' ? Math.PI / 4 : 0))

/** Frames the camera on a ground-level centre point. */
function aim(centreX: number, centreZ: number, aspect: number, fov: number) {
  camera.aspect = aspect
  camera.fov = fov
  if (camMode === 'side') {
    camera.position.set(centreX, 1.5, centreZ + 8)
    camera.lookAt(centreX, 0.9, centreZ)
  } else {
    camera.position.set(centreX, 0.6 + GAME_DISTANCE * Math.sin(GAME_PITCH), centreZ + GAME_DISTANCE * Math.cos(GAME_PITCH))
    camera.lookAt(centreX, 0.6, centreZ)
  }
  camera.updateProjectionMatrix()
}

function fitScreen() {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
  renderer.setSize(window.innerWidth, window.innerHeight, false)
  aim(0, 0, window.innerWidth / window.innerHeight, camMode === 'side' ? 30 : 40)
}

/**
 * 12 evenly spaced frames of one loop, moving at the clip's own ground speed past a
 * fixed camera. Skinning refreshes bone matrices once per animation frame, so each
 * frame is rendered and copied in its own frame.
 */
async function renderSheet(clip: string): Promise<string> {
  const gait = clip === 'walk' ? view.walk : clip === 'run' ? view.run : null
  const speed = gait?.speed ?? 0
  const duration = view.duration(clip)
  const travel = speed * duration
  const frames = SHEET.cols * SHEET.rows
  const height = 2.4
  const width = travel + 2.4
  const cellHeight = SHEET.cellHeight
  const cellWidth = Math.round((cellHeight * width) / height)
  const sheet = document.createElement('canvas')
  sheet.width = cellWidth * SHEET.cols
  sheet.height = cellHeight * SHEET.rows
  const ctx = sheet.getContext('2d')!
  ctx.font = '14px system-ui, sans-serif'
  renderer.setPixelRatio(1)
  renderer.setSize(cellWidth, cellHeight, false)
  const fov = camMode === 'side' ? (2 * Math.atan(height / 2 / 8) * 180) / Math.PI : 18
  // Leave space ahead for the idle sword as well as the moving silhouette.
  const centreX = (travel / 2 + 0.3) * Math.cos(facing)
  const centreZ = (travel / 2 + 0.3) * Math.sin(facing)
  aim(centreX, centreZ, cellWidth / cellHeight, fov)
  sun.position.set(centreX - 5, 10, centreZ + 7)
  sun.target.position.set(centreX, 0, centreZ)
  for (let i = 0; i < frames; i++) {
    await new Promise(requestAnimationFrame)
    const time = (i / frames) * duration
    view.object.position.set(speed * time * Math.cos(facing), 0, speed * time * Math.sin(facing))
    if (gait || clip === 'idle') view.pose({ speed, facing, time })
    else view.poseClip(clip, time, facing)
    renderer.render(scene, camera)
    const x = (i % SHEET.cols) * cellWidth
    const y = Math.floor(i / SHEET.cols) * cellHeight
    ctx.drawImage(canvas, x, y)
    ctx.fillStyle = '#1a1c33'
    ctx.fillText(`${clip} #${i}  t=${time.toFixed(3)}s`, x + 8, y + 18)
    ctx.strokeStyle = 'rgb(26 28 51 / 0.35)'
    ctx.strokeRect(x + 0.5, y + 0.5, cellWidth - 1, cellHeight - 1)
  }
  return sheet.toDataURL('image/png')
}

if (sheetParam) {
  anim.sheet = await renderSheet(sheetParam)
  const img = document.createElement('img')
  img.id = 'sheet'
  img.alt = `${sheetParam} contact sheet`
  img.src = anim.sheet
  await img.decode()
  document.body.append(img)
} else if (clipParam) {
  const t = Number(params.get('t') ?? 0)
  fitScreen()
  window.addEventListener('resize', fitScreen)
  const draw = () => {
    view.poseClip(clipParam, t, facing)
    renderer.render(scene, camera)
  }
  draw()
  renderer.setAnimationLoop(draw)
} else {
  const slider = document.getElementById('speed') as HTMLInputElement
  const readout = document.getElementById('readout')!
  document.getElementById('panel')!.hidden = false
  slider.value = params.get('speed') ?? '0'
  fitScreen()
  window.addEventListener('resize', fitScreen)
  // Wall-clock time is fine here: the viewer integrates it, and the pose is a pure function of what it passes.
  let last: number | null = null
  let time = 0
  let phase = 0
  let distance = 0
  renderer.setAnimationLoop((now: number) => {
    const dt = last === null ? 0 : Math.min((now - last) / 1000, 0.1)
    last = now
    const speed = Number(slider.value)
    time += dt
    phase += view.cycleRate(speed) * dt
    distance += speed * dt
    // Treadmill: the ground slides under a character that stays at the origin.
    ground.position.x = -(distance * Math.cos(facing)) % 1
    ground.position.z = -(distance * Math.sin(facing)) % 1
    view.pose({ speed, facing, time, phase })
    readout.textContent = `${speed.toFixed(2)} m/s  (walk ${view.walk.speed.toFixed(2)}, run ${view.run.speed.toFixed(2)})`
    renderer.render(scene, camera)
  })
}

anim.ready = true
