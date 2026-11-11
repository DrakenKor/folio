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
import { CLIP_NAMES, type ClipName } from '../render/characters/markers'
import { AimIndicator } from '../render/characters/aim'
import { renderCharacterSheet } from '../render/characters/sheet'
import { previewLength, previewState } from './preview'
import { combatSnapshot } from './fixture'

// Dev-only, tick-stepped state-machine preview; ?clip=, ?age= and ?sheet= are reproducible.
const params = new URLSearchParams(location.search)
const clipParam = params.get('clip')
const sheetParam = params.get('sheet')
const camMode = params.get('cam') ?? (sheetParam ? 'side' : 'game')
const GAME_PITCH = (55 * Math.PI) / 180
const GAME_DISTANCE = 15
let selected = (clipParam ?? 'idle') as ClipName
if (!CLIP_NAMES.includes(selected)) throw new Error(`unknown clip ${selected}`)
let age = Number(params.get('age') ?? Number(params.get('t') ?? 0) * 60)
let playing = !clipParam && !params.has('age')
const anim = { ready: false, clips: CLIP_NAMES, sheet: null as string | null, backend: '', gaits: {},
  view: null as CharacterView | null, setState, step, fixture: combatSnapshot,
  get state() { return { clip: selected, age, pose: view.poseActor(previewState(selected, age, facing)) } } }
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

const indicator = new AimIndicator()
scene.add(indicator.object)
const select = document.getElementById('state') as HTMLSelectElement
const timeline = document.getElementById('age') as HTMLInputElement
const slider = document.getElementById('speed') as HTMLInputElement
const readout = document.getElementById('readout')!
const play = document.getElementById('play') as HTMLButtonElement
for (const clip of CLIP_NAMES) select.add(new Option(clip, clip))
slider.value = params.get('speed') ?? '2.521'

function setState(clip: ClipName, tick = 0): void {
  if (!CLIP_NAMES.includes(clip)) throw new Error(`unknown clip ${clip}`)
  selected = clip
  age = Math.max(0, tick)
  playing = false
  select.value = clip
  timeline.max = String(previewLength(clip))
  timeline.value = String(age)
}

function step(ticks = 1): void { setState(selected, age + ticks) }

function draw(): void {
  const state = previewState(selected, age, facing)
  if (selected === 'walk' || selected === 'run') {
    state.actor = { ...state.actor, gait: { speed: Number(slider.value),
      phase: age / 60 * view.cycleRate(Number(slider.value)) } }
  }
  const pose = view.poseActor(state)
  indicator.point(pose.aim)
  indicator.object.visible = !state.actor.death
  // A deterministic treadmill keeps the contact grid readable at any stepped age.
  const distance = state.actor.gait.speed * age / 60
  ground.position.x = -(distance * Math.cos(facing)) % 1
  ground.position.z = -(distance * Math.sin(facing)) % 1
  timeline.value = String(age)
  play.textContent = playing ? 'Pause' : 'Play'
  readout.textContent = `${selected} · age ${age.toFixed(1)} / ${previewLength(selected)} ticks`
  renderer.render(scene, camera)
}

if (sheetParam) {
  anim.sheet = await renderCharacterSheet(undefined, sheetParam, params.get('backend') === 'webgl')
  const img = document.createElement('img')
  img.id = 'sheet'
  img.alt = `${sheetParam} contact sheet`
  img.src = anim.sheet
  await img.decode()
  document.body.append(img)
} else {
  document.getElementById('panel')!.hidden = false
  setState(selected, age)
  playing = !clipParam && !params.has('age')
  select.onchange = () => setState(select.value as ClipName)
  timeline.oninput = () => setState(selected, Number(timeline.value))
  document.getElementById('step')!.onclick = () => step()
  document.getElementById('previous')!.onclick = () => setState(CLIP_NAMES[(CLIP_NAMES.indexOf(selected) + 11) % 12]!)
  document.getElementById('next')!.onclick = () => setState(CLIP_NAMES[(CLIP_NAMES.indexOf(selected) + 1) % 12]!)
  play.onclick = () => { playing = !playing }
  fitScreen()
  window.addEventListener('resize', fitScreen)
  let last: number | undefined
  renderer.setAnimationLoop((now: number) => {
    if (playing && last !== undefined) {
      age = (age + Math.min(0.1, (now - last) / 1000) * 60) % (previewLength(selected) + 12)
    }
    last = now
    draw()
  })
}
anim.ready = true
