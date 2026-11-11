import { AnimationMixer, Box3, Group, LoopOnce, Mesh, Vector3, type AnimationAction, type AnimationClip, type Object3D } from 'three/webgpu'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js'
import { applyToon } from './toon'
import { createEnvironment, type Environment } from '../materials/environment'
import { characterPose, type CharacterPose, type PoseState } from './pose'

/** Clips that repeat; every other clip holds its last frame. */
const LOOPS = new Set(['idle', 'walk', 'run', 'block'])
/** Fraction of walking speed at which the walk fully replaces idle. */
const WALK_IN = 0.4
/** Foot bones, as GLTFLoader names them (it strips the dots from `foot.l`). */
const FEET = ['footl', 'footr'] as const

export interface CharacterAsset {
  scene: Object3D
  clips: AnimationClip[]
}

/** A looping gait measured from its clip: the ground speed at which the planted foot does not slide. */
export interface Gait {
  /** Metres per second. */
  speed: number
  /** Metres covered in one cycle. */
  stride: number
  duration: number
  /** Cycle phase at the middle of left-foot contact; aligns walk with run. */
  offset: number
}

export interface LocomotionPose {
  /** Ground speed in metres per second. */
  speed: number
  /** Radians, measured from +x towards +z, as in the simulation. */
  facing: number
  /** Seconds. Drives idle and, unless `phase` is given, the gait cycle at constant speed. */
  time: number
  /** Gait cycles completed, for callers that integrate speed changes themselves. */
  phase?: number
}

export async function loadCharacter(url: string): Promise<CharacterAsset> {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
  const gltf = await loader.loadAsync(url)
  return { scene: gltf.scene, clips: gltf.animations }
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const wrap = (x: number, period: number) => x - Math.floor(x / period) * period

/**
 * One animated, toon-shaded instance of a character. The pose is a pure function
 * of its inputs: each call resets the actions and samples absolute clip times
 * through AnimationMixer.setTime, without accumulating deltas.
 */
export class CharacterView {
  /** Place and turn this; the model inside is scaled to `height`. */
  readonly object = new Group()
  readonly clips: readonly string[]
  readonly walk: Gait
  readonly run: Gait
  private readonly model: Object3D
  private readonly mixer: AnimationMixer
  private readonly actions = new Map<string, AnimationAction>()
  private readonly ownEnvironment: Environment | null

  constructor(asset: CharacterAsset, { height = 1.8, env }: { height?: number; env?: Environment } = {}) {
    this.ownEnvironment = env ? null : createEnvironment(0)
    this.model = cloneSkinned(asset.scene)
    applyToon(this.model, env ?? this.ownEnvironment!)
    this.object.add(this.model)
    this.mixer = new AnimationMixer(this.model)
    for (const source of asset.clips) {
      const clip = source.clone()
      if (clip.name === 'dodge') {
        const track = clip.tracks.find(track => track.name === 'root.position')
        if (!track) throw new Error('missing dodge root translation')
        for (let i = 0; i < track.values.length; i += 3) {
          track.values[i] = track.values[0]!
          track.values[i + 2] = track.values[2]!
        }
      }
      const action = this.mixer.clipAction(clip)
      action.setLoop(LoopOnce, 1)
      action.clampWhenFinished = true
      action.play()
      action.setEffectiveWeight(0)
      this.actions.set(clip.name, action)
    }
    this.clips = asset.clips.map((clip) => clip.name)

    this.poseClip('idle', 0)
    const box = new Box3().setFromObject(this.model, true)
    this.model.scale.setScalar(height / box.max.y)
    this.walk = this.measureGait('walk')
    this.run = this.measureGait('run')
    this.pose({ speed: 0, facing: 0, time: 0 })
  }

  /** Gait cycles per second at a ground speed. */
  cycleRate(speed: number): number {
    const k = clamp01((speed - this.walk.speed) / (this.run.speed - this.walk.speed))
    return Math.max(0, speed) / (this.walk.stride + (this.run.stride - this.walk.stride) * k)
  }

  /** Apply the simulation pose without advancing presentation time. */
  poseActor(state: Readonly<PoseState>, alpha = 0): CharacterPose {
    const pose = characterPose(state, alpha)
    this.setFacing(pose.facing)
    this.apply(pose.clips)
    return pose
  }

  /** Idle, walk and run blended by speed, with cadence matched to speed so the feet plant. */
  pose({ speed, facing, time, phase }: LocomotionPose): void {
    const { walk, run } = this
    const k = clamp01((speed - walk.speed) / (run.speed - walk.speed))
    const moving = clamp01(speed / (walk.speed * WALK_IN))
    const cycle = phase ?? time * this.cycleRate(speed)
    this.setFacing(facing)
    this.apply({
      idle: [1 - moving, wrap(time, this.duration('idle'))],
      walk: [moving * (1 - k), wrap(cycle + walk.offset, 1) * walk.duration],
      run: [moving * k, wrap(cycle + run.offset, 1) * run.duration]
    })
  }

  /** One clip alone at a time in seconds: looping clips wrap, the rest hold their last frame. */
  poseClip(name: string, time: number, facing = 0): void {
    const duration = this.duration(name)
    this.setFacing(facing)
    this.apply({ [name]: [1, LOOPS.has(name) ? wrap(time, duration) : Math.min(Math.max(time, 0), duration)] })
  }

  duration(name: string): number {
    const action = this.actions.get(name)
    if (!action) throw new Error(`unknown clip ${name}`)
    return action.getClip().duration
  }

  /** Rebinds scene uniforms and noise when the meadow seed changes. */
  setEnvironment(env: Environment): void { applyToon(this.model, env) }

  dispose(): void {
    this.mixer.stopAllAction()
    this.mixer.uncacheRoot(this.model)
    this.model.traverse(node => {
      if (!(node instanceof Mesh)) return
      node.geometry.dispose()
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) material.dispose()
    })
    this.ownEnvironment?.noise.dispose()
    this.object.removeFromParent()
  }

  private setFacing(facing: number): void {
    // The model faces +z; the simulation measures facing from +x towards +z.
    this.object.rotation.y = Math.PI / 2 - facing
  }

  private apply(weights: Partial<Record<string, readonly [weight: number, time: number]>>): void {
    for (const [name, action] of this.actions) {
      const [weight, time] = weights[name] ?? [0, 0]
      action.reset()
      action.setEffectiveWeight(weight)
      // At the fixed mixer time 1, each action samples its own absolute clip time.
      action.setEffectiveTimeScale(time)
    }
    this.mixer.setTime(1)
  }

  /** Samples a looping clip and finds how fast the planted foot moves backwards relative to the body. */
  private measureGait(name: string): Gait {
    const duration = this.duration(name)
    const samples = 96
    const feet = FEET.map((bone) => {
      const node = this.model.getObjectByName(bone)
      if (!node) throw new Error(`missing bone ${bone}`)
      return { node, y: [] as number[], z: [] as number[] }
    })
    const position = new Vector3()
    for (let i = 0; i < samples; i++) {
      this.poseClip(name, (i / samples) * duration)
      this.object.updateMatrixWorld(true)
      for (const foot of feet) {
        foot.node.getWorldPosition(position)
        this.object.worldToLocal(position)
        foot.y.push(position.y)
        foot.z.push(position.z)
      }
    }
    const dt = duration / samples
    let sum = 0
    let count = 0
    for (const foot of feet) {
      const floor = Math.min(...foot.y)
      for (let i = 0; i < samples; i++) {
        if (foot.y[i]! > floor + 0.02) continue
        const ahead = foot.z[(i + 1) % samples]!
        const behind = foot.z[(i + samples - 1) % samples]!
        sum += (behind - ahead) / (2 * dt)
        count++
      }
    }
    const speed = sum / count
    const left = feet[0]!.y
    const contactHeight = Math.min(...left) + 0.02
    const start = left.findIndex((y, i) => y <= contactHeight && left[(i + samples - 1) % samples]! > contactHeight)
    let contactSamples = 0
    while (contactSamples < samples && left[(start + contactSamples) % samples]! <= contactHeight) contactSamples++
    const offset = wrap((start + (contactSamples - 1) / 2) / samples, 1)
    return { speed, stride: speed * duration, duration, offset }
  }
}
