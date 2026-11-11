import { WebGPURenderer } from 'three/webgpu'
import { createHUD } from './ui/hud'
import { Clock } from './platform/clock'
import { Input } from './platform/input'
import { initialWorld, storeSession } from './platform/session'
import { BasicView } from './render/basic/view'
import { MeadowView } from './render/meadow-view'
import { createAPI } from './debug/api'
import { graphicsStopped, toast } from './debug/overlay'

const canvas = document.getElementById('stage') as HTMLCanvasElement
const url = new URL(location.href)
const initial = await initialWorld(url)
const renderer = new WebGPURenderer({ canvas, antialias: true, forceWebGL: url.searchParams.get('backend') === 'webgl' })
await renderer.init()
document.body.dataset.backend = 'isWebGPUBackend' in renderer.backend ? 'webgpu' : 'webgl2'
const view = url.searchParams.get('view') === 'basic' ? new BasicView(renderer) : await MeadowView.create(renderer, initial.world)
const input = new Input(canvas, () => view.camera.basis(), (x, y) => view instanceof MeadowView ? view.groundPoint(x, y) : view.camera.groundPoint(x, y))
const clock = new Clock(initial.world, world => {
  if (view instanceof MeadowView) view.advance(world)
  return input.command(world)
}, world => {
  input.afterStep(world)
  if (view instanceof MeadowView) view.advance(world)
})
if (initial.paused) clock.pause()
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
  storeSession(clock.world, true, true)
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

const api = createAPI(clock, input, view.camera, ready, loseDevice)
Object.assign(api.debug, { view })
Object.assign(api, {
  async sheet(entity: string, clip: string): Promise<string> {
    const subject = clock.world.entities.find(candidate => entity === 'player' ? candidate.id === clock.world.playerId : String(candidate.id) === entity)
    if (!subject || subject.kind !== 'player') throw new Error(`No knight entity: ${entity}`)
    const { renderCharacterSheet } = await import('./render/characters/sheet')
    return renderCharacterSheet(view instanceof MeadowView ? view.asset : undefined, clip, url.searchParams.get('backend') === 'webgl')
  }
})
const hud = createHUD(() => api.restart())
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

window.addEventListener('pagehide', () => {
  if (import.meta.env.DEV) storeSession(clock.world, clock.userPaused)
}, options)

if (import.meta.hot) import.meta.hot.dispose(() => {
  cancelAnimationFrame(animation)
  storeSession(clock.world, clock.userPaused)
  listeners.abort()
  input.dispose()
  hud.dispose()
  view.dispose()
  void renderer.dispose()
})
