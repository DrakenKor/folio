// Assembles the meadow from its modules. A RenderView can own one of these:
// it takes a seed, builds everything deterministically, and exposes the few
// knobs a view needs (time, focus, player position, light).
import type { World } from '../sim/core/types'
import { Color, DirectionalLight, HemisphereLight, Scene, Vector3, type Camera } from 'three/webgpu'
import { createEnvironment, type Environment } from './materials/environment'
import { hazeFog } from './materials/haze'
import { installSmoothShadows } from './materials/shadow'
import { createHeightfield } from './terrain/heightfield'
import { createTerrain } from './terrain/terrain'
import { createGrass } from './foliage/grass'
import { createSky } from './sky/sky'
import { createTrees } from './foliage/trees'
import { createFlowers } from './foliage/flowers'
import { createRocks } from './props/rocks'
import { createMonolith } from './props/monolith'
import { createBanners } from './props/banners'

export interface SunSettings {
  /** Degrees above the horizon. */
  elevation: number
  /** Degrees clockwise from north (-z) seen from above. */
  azimuth: number
  intensity: number
  fill: number
}

export function createMeadow(seed: number, arena: World['arena'] = null) {
  const env: Environment = createEnvironment(seed)
  const field = createHeightfield(seed, arena)
  const scene = new Scene()
  scene.name = 'meadow'
  scene.fogNode = hazeFog(env)

  const sun = new DirectionalLight(new Color(env.palette.sun), 3)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.bias = -0.0006
  sun.shadow.normalBias = 0.18
  sun.shadow.radius = 1.4
  installSmoothShadows(sun.shadow)
  scene.add(sun, sun.target)
  const fill = new HemisphereLight(new Color(env.palette.skyFill), new Color(env.palette.groundFill), 1.3)
  scene.add(fill)

  const terrain = createTerrain(env, field)
  const grass = createGrass(env, field)
  const sky = createSky(env)
  const flowers = createFlowers(env, field)
  const trees = createTrees(env, field)
  const rocks = createRocks(env, field, trees.sites)
  const monolith = createMonolith(env, field)
  const banners = createBanners(env, field)
  scene.add(terrain.mesh, grass.mesh, flowers.mesh, sky.group, trees.trunks, trees.canopies, rocks.mesh, monolith.group, banners.group)

  const sunSettings: SunSettings = { elevation: 43, azimuth: 105, intensity: 3.0, fill: 2.0 }
  const shadowFocus = new Vector3()
  let shadowExtent = 60

  function applySun() {
    const el = (sunSettings.elevation * Math.PI) / 180
    const az = (sunSettings.azimuth * Math.PI) / 180
    env.sunDirection.value.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize()
    sun.intensity = sunSettings.intensity
    env.sunColor.value.set(env.palette.sun).multiplyScalar(sunSettings.intensity)
    fill.intensity = sunSettings.fill
    placeShadow()
  }

  function placeShadow() {
    const d = env.sunDirection.value
    sun.target.position.copy(shadowFocus)
    sun.position.copy(shadowFocus).addScaledVector(d, 200)
    const cam = sun.shadow.camera
    cam.left = cam.bottom = -shadowExtent
    cam.right = cam.top = shadowExtent
    cam.near = 20
    cam.far = 420
    cam.updateProjectionMatrix()
    sun.shadow.needsUpdate = true
  }

  applySun()

  return {
    scene,
    env,
    field,
    sun,
    fill,
    terrain,
    grass,
    flowers,
    sky,
    trees,
    rocks,
    monolith,
    banners,
    sunSettings,
    applySun,
    /** Centres the shadow map on a ground point; the grass follows the camera itself. */
    setFocus(x: number, z: number, extent: number) {
      shadowFocus.set(x, field.heightAt(x, z), z)
      shadowExtent = extent
      placeShadow()
    },
    setPlayer(x: number, z: number) {
      grass.setPlayer(x, z)
    },
    update(time: number, camera: Camera) {
      env.time.value = time
      sky.update(camera)
      monolith.update(time)
    }
  }
}

export type Meadow = ReturnType<typeof createMeadow>
