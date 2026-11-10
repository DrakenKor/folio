import { Color, DirectionalLight, GridHelper, HemisphereLight, Mesh, MeshToonNodeMaterial,
  PCFShadowMap, PerspectiveCamera, PlaneGeometry, Scene, WebGPURenderer } from 'three/webgpu'
import { CharacterView, loadCharacter, type CharacterAsset } from './character'

/** Twelve fixed samples moving over a quarter-metre grid, for judging silhouette and foot contact. */
export async function renderCharacterSheet(asset: CharacterAsset | undefined, clip: string, forceWebGL: boolean): Promise<string> {
  const canvas = document.createElement('canvas')
  const renderer = new WebGPURenderer({ canvas, antialias: true, forceWebGL })
  await renderer.init()
  const character = new CharacterView(asset ?? await loadCharacter(`${import.meta.env.BASE_URL}pack/characters/knight.glb`))
  const scene = new Scene()
  try {
    const duration = character.duration(clip)
    const gait = clip === 'walk' ? character.walk : clip === 'run' ? character.run : null
    const speed = gait?.speed ?? 0
    const travel = speed * duration
    const cellHeight = 320
    const cellWidth = Math.round(cellHeight * (travel + 2.4) / 2.4)
    renderer.setPixelRatio(1)
    renderer.setSize(cellWidth, cellHeight, false)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = PCFShadowMap
    scene.background = new Color(0xc9d3d6)
    scene.add(new HemisphereLight(0xbcd4ff, 0x5c5346, 1.1))
    const sun = new DirectionalLight(0xffe2b8, 2.6)
    const centre = travel / 2 + 0.3
    sun.position.set(centre - 5, 10, 7)
    sun.target.position.set(centre, 0, 0)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.left = sun.shadow.camera.bottom = -8
    sun.shadow.camera.right = sun.shadow.camera.top = 8
    sun.shadow.normalBias = 0.02
    scene.add(sun, sun.target, character.object)
    const plane = new Mesh(new PlaneGeometry(80, 80), new MeshToonNodeMaterial({ color: 0x9aa392 }))
    plane.rotation.x = -Math.PI / 2
    plane.receiveShadow = true
    const minor = new GridHelper(80, 320, 0x8a937f, 0x8a937f)
    const major = new GridHelper(80, 80, 0x6c7563, 0x6c7563)
    minor.position.y = 0.002
    major.position.y = 0.003
    scene.add(plane, minor, major)
    const camera = new PerspectiveCamera(2 * Math.atan(1.2 / 8) * 180 / Math.PI, cellWidth / cellHeight, 0.1, 200)
    camera.position.set(centre, 1.5, 8)
    camera.lookAt(centre, 0.9, 0)
    const sheet = document.createElement('canvas')
    sheet.width = cellWidth * 4
    sheet.height = cellHeight * 3
    const context = sheet.getContext('2d')!
    context.font = '14px system-ui, sans-serif'
    for (let i = 0; i < 12; i++) {
      await new Promise(requestAnimationFrame)
      const time = i / 12 * duration
      character.object.position.set(speed * time, 0, 0)
      if (gait || clip === 'idle') character.pose({ speed, facing: 0, time, phase: time * character.cycleRate(speed) })
      else character.poseClip(clip, time)
      renderer.render(scene, camera)
      const x = i % 4 * cellWidth
      const y = Math.floor(i / 4) * cellHeight
      context.drawImage(canvas, x, y)
      context.fillStyle = '#1a1c33'
      context.fillText(`${clip} #${i}  t=${time.toFixed(3)}s`, x + 8, y + 18)
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
    await renderer.dispose()
  }
}
