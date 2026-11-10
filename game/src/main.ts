import { Color, Mesh, MeshStandardNodeMaterial, PerspectiveCamera, PlaneGeometry, Scene, WebGPURenderer, DirectionalLight, HemisphereLight } from 'three/webgpu'

// Placeholder entry: an empty lit scene. T0.3 replaces this with the platform
// clock, simulation and debug API.
const canvas = document.getElementById('stage') as HTMLCanvasElement
const params = new URLSearchParams(location.search)

const renderer = new WebGPURenderer({
  canvas,
  antialias: true,
  forceWebGL: params.get('backend') === 'webgl'
})
await renderer.init()

const scene = new Scene()
scene.background = new Color(0x9cc7e8)
scene.add(new HemisphereLight(0xdfefff, 0x4a6b3a, 1.2))
const sun = new DirectionalLight(0xfff1d6, 2)
sun.position.set(30, 50, 20)
scene.add(sun)

const ground = new Mesh(new PlaneGeometry(200, 200), new MeshStandardNodeMaterial({ color: 0x6fa35a }))
ground.rotation.x = -Math.PI / 2
scene.add(ground)

const camera = new PerspectiveCamera(45, 1, 0.1, 1000)
camera.position.set(0, 30, 22)
camera.lookAt(0, 0, 0)

function resize() {
  const ratio = Math.min(window.devicePixelRatio, 1.5)
  renderer.setPixelRatio(ratio)
  renderer.setSize(window.innerWidth, window.innerHeight, false)
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
}
window.addEventListener('resize', resize)
resize()

renderer.setAnimationLoop(() => renderer.render(scene, camera))

Object.assign(window, {
  __game: { ready: true, backend: 'isWebGPUBackend' in renderer.backend ? 'webgpu' : 'webgl2' }
})
