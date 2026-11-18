import { WebGPURenderer } from 'three/webgpu'
import { m2Content } from './content/m2'
import { exportCharacter, loadCharacter } from './sim/core'
import { SaveController } from './platform/saves'
import { createHUD } from './ui/hud'
import { Clock } from './platform/clock'
import { Input } from './platform/input'
import { initialWorld, recoverSession, storeSession } from './platform/session'
import { BasicView } from './render/basic/view'
import { MeadowView } from './render/meadow-view'
import { createAPI } from './debug/api'
import { graphicsStopped, toast } from './debug/overlay'

const canvas = document.getElementById('stage') as HTMLCanvasElement
const url = new URL(location.href)
const initial = await initialWorld(url)
let playerSession = initial.playerEntry
let phase = initial.world.encounter?.phase
let releaseInput = () => {}
const clock: Clock = new Clock(initial.world, world => {
  if (view instanceof MeadowView) view.advance(world)
  return input.command(world)
}, world => {
  input.afterStep(world)
  if (view instanceof MeadowView) view.advance(world)
  if (phase !== world.encounter?.phase) {
    phase = world.encounter?.phase
    input.release()
    if (playerSession) void saves.flush()
  }
})
const replaceWorld = (world: typeof initial.world) => {
  releaseInput()
  phase = world.encounter?.phase
  clock.replace(world)
}
const saves = new SaveController({
  build: __BUILD_ID__, content: initial.playerEntry ? initial.world.content : m2Content(), getWorld: () => clock.world,
  isPlayerSession: () => playerSession,
  replaceWorld: world => { playerSession = initial.playerEntry; replaceWorld(world) }, exportCharacter, loadCharacter
})
if (initial.playerEntry) await saves.load()
const recovered = recoverSession(initial.recovery, initial.playerEntry, saves.status())
if (recovered) {
  playerSession = recovered.playerSession
  replaceWorld(recovered.world)
}
if (initial.paused || recovered?.paused) clock.pause()

const renderer = new WebGPURenderer({ canvas, antialias: true, forceWebGL: url.searchParams.get('backend') === 'webgl' })
await renderer.init()
document.body.dataset.backend = 'isWebGPUBackend' in renderer.backend ? 'webgpu' : 'webgl2'
const view = url.searchParams.get('view') === 'basic' ? new BasicView(renderer) : await MeadowView.create(renderer, clock.world)
const input = new Input(canvas, () => view.camera.basis(), (x, y) => view instanceof MeadowView ? view.groundPoint(x, y) : view.camera.groundPoint(x, y))
releaseInput = () => input.release()
if (url.searchParams.has('bookmark')) view.camera.bookmark(url.searchParams.get('bookmark')!)

let lost = false
let animation = 0
let firstFrame!: () => void
const ready = new Promise<void>(resolve => { firstFrame = resolve })
const listeners = new AbortController()
const options = { signal: listeners.signal }

function suspension(): void {
  clock.suspend('hidden', document.hidden)
  clock.suspend('blur', !document.hasFocus())
  if (clock.paused) input.release()
}
window.addEventListener('blur', suspension, options)
window.addEventListener('focus', suspension, options)
document.addEventListener('visibilitychange', suspension, options)
suspension()

renderer.onDeviceLost = () => {
  if (lost) return
  lost = true
  clock.suspend('graphics', true)
  input.release()
  cancelAnimationFrame(animation)
  const { code, generation } = saves.status()
  storeSession(url, clock.world, clock.userPaused, playerSession, true, { code, generation })
  graphicsStopped()
}

function loseDevice(): void {
  if (lost) return
  if ('isWebGPUBackend' in renderer.backend) {
    const backend = renderer.backend as unknown as { device: { destroy(): void } }
    backend.device.destroy()
    // three.js suppresses intentional device destruction; forward this injected loss.
    renderer.onDeviceLost({ api: 'WebGPU', message: 'Debug device loss', reason: 'destroyed', originalEvent: null })
  } else {
    const extension = (renderer.getContext() as WebGL2RenderingContext).getExtension('WEBGL_lose_context')
    if (!extension) throw new Error('WEBGL_lose_context is unavailable')
    extension.loseContext()
  }
}

const api = createAPI(clock, input, view.camera, ready, loseDevice, saves, world => {
  playerSession = false
  phase = world.encounter?.phase
})
Object.assign(api.debug, { view })
Object.assign(api, {
  async sheet(entity: string, clip: string): Promise<string> {
    const subject = clock.world.entities.find(candidate => entity === 'player' ? candidate.id === clock.world.playerId : String(candidate.id) === entity)
    if (!subject || subject.kind !== 'player') throw new Error(`No knight entity: ${entity}`)
    const { renderCharacterSheet } = await import('./render/characters/sheet')
    return renderCharacterSheet(view instanceof MeadowView ? view.asset : undefined, clip, url.searchParams.get('backend') === 'webgl')
  }
})
const hud = createHUD({ clock, input, api, saves })
if (import.meta.env.DEV || url.searchParams.get('debug') === '1') window.__game = api

window.addEventListener('keydown', async event => {
  if (event.code !== 'F8' || event.repeat) return
  event.preventDefault()
  const text = await api.exportReplay()
  try {
    await navigator.clipboard.writeText(text)
    toast('Replay copied')
  } catch {
    toast('Clipboard refused. Replay logged in console.')
    console.warn('Replay:', text)
  }
}, options)

function resize(): void { view.resize(innerWidth, innerHeight, Math.min(devicePixelRatio, 1.5)) }
window.addEventListener('resize', resize, options)
resize()

function draw(now: number): void {
  if (lost) return
  view.sync(clock.frame(now))
  hud.sync(clock.world)
  view.render()
  firstFrame()
  animation = requestAnimationFrame(draw)
}
animation = requestAnimationFrame(draw)

if (import.meta.hot) import.meta.hot.dispose(() => {
  cancelAnimationFrame(animation)
  if (!initial.playerEntry) storeSession(url, clock.world, clock.userPaused, false)
  listeners.abort()
  input.dispose()
  hud.dispose()
  saves.dispose()
  view.dispose()
  void renderer.dispose()
})

declare const __BUILD_ID__: string
