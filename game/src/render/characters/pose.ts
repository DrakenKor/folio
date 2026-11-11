import { GAIT, TICK_DT, type ActionState, type ActionTiming, type Entity, type World } from '../../sim/core/types'
import { CLIP_MARKERS, type ClipName } from './markers'

const clamp = (n: number) => Math.max(0, Math.min(1, n))
const mix = (a: number, b: number, alpha: number) => a + (b - a) * alpha
const wrap = (n: number, period: number) => n - Math.floor(n / period) * period
const MELEE = ['attack', 'attack_slice', 'attack_stab'] as const
const CAST = ['cast', 'cast_long'] as const

export interface PoseState {
  actor: Readonly<Entity>
  tick: number
  timing: Readonly<ActionTiming> | null
  flashTicks: number
  /** Adjacent samples are disposable; absent after replacement or manual stepping. */
  previous?: Readonly<Entity>
  /** Debug preview only, including block and otherwise unused variants. */
  clip?: ClipName
}

export interface CharacterPose {
  clips: Partial<Record<ClipName, readonly [weight: number, time: number]>>
  facing: number
  aim: number
  flash: number
}

/** Stable selection uses only serialized action identity, never presentation history. */
export function actionClip(actorId: number, action: Readonly<ActionState>): ClipName {
  if (action.kind === 'dodge') return 'dodge'
  let hash = 2166136261
  for (const code of `${action.id}:${actorId}:${action.startTick}`) hash = Math.imul(hash ^ code.charCodeAt(0), 16777619) >>> 0
  const variants = action.kind === 'melee' ? MELEE : CAST
  return variants[hash % variants.length]!
}

/** Map half-open gameplay phases onto authored start/contact/recovery/end markers. */
export function actionTime(clip: ClipName, timing: Readonly<ActionTiming>, age: number): number {
  const m = CLIP_MARKERS[clip]
  const { windupTicks: w, activeTicks: a, recoveryTicks: r } = timing
  if (age < w) return mix(m.start, m.contact, clamp(age / w))
  if (age < w + a) return mix(m.contact, m.recovery, clamp((age - w) / a))
  return mix(m.recovery, m.end, r ? clamp((age - w - a) / r) : 1)
}

export function actorPoseState(actor: Readonly<Entity>, world: Readonly<World>, previous?: Readonly<Entity>): PoseState {
  const skill = world.content.skills.find(skill => skill.id === actor.action?.id)
  return { actor, tick: world.tick, timing: actor.action?.kind === 'dodge' ? world.content.dodge.timing : skill?.timing ?? null,
    flashTicks: Math.max(1, ...world.content.skills.map(skill => skill.hitFlashTicks)), previous }
}

/** Reconstruct weights and absolute seconds from one completed simulation state. */
export function characterPose(state: Readonly<PoseState>, alpha = 0): CharacterPose {
  const { actor, timing, tick, clip: override } = state
  const previous = alpha > 0 && actor.impactPauseTicks === 0 ? state.previous : undefined
  const fraction = clamp(alpha)
  const phase = previous ? mix(previous.gait.phase, actor.gait.phase, fraction) : actor.gait.phase
  const speed = actor.gait.speed
  const k = clamp((speed - GAIT.walkSpeed) / (GAIT.runSpeed - GAIT.walkSpeed))
  const moving = clamp(speed / (GAIT.walkSpeed * 0.4))
  const clips: CharacterPose['clips'] = {
    idle: [1 - moving, wrap(tick * TICK_DT, CLIP_MARKERS.idle.end)],
    walk: [moving * (1 - k), wrap(phase + CLIP_MARKERS.walk.offset, 1) * CLIP_MARKERS.walk.end],
    run: [moving * k, wrap(phase + CLIP_MARKERS.run.offset, 1) * CLIP_MARKERS.run.end]
  }
  const result = { clips, facing: actor.facing, aim: actor.aim, flash: actor.hitFlashTicks > 0 ? 1 : 0 }
  if (actor.death) {
    const age = previous?.death?.startTick === actor.death.startTick ?
      mix(previous.death.ageTicks, actor.death.ageTicks, fraction) : actor.death.ageTicks
    return { ...result, clips: { death: [1, Math.min(age * TICK_DT, CLIP_MARKERS.death.end)] } }
  }
  if (override === 'block') return { ...result, clips: { block: [1, wrap(tick * TICK_DT, CLIP_MARKERS.block.end)] } }
  if (actor.action && timing) {
    const action = actor.action
    const same = previous?.action?.id === action.id && previous.action.startTick === action.startTick
    const age = same ? mix(previous.action!.ageTicks, action.ageTicks, fraction) : action.ageTicks
    const clip = override ?? actionClip(actor.id, action)
    const total = timing.windupTicks + timing.activeTicks + timing.recoveryTicks
    const weight = Math.min(clamp((age + 1) / 2), timing.recoveryTicks ? clamp((total - age) / Math.min(4, timing.recoveryTicks)) : 1)
    for (const name of ['idle', 'walk', 'run'] as const) clips[name] = [clips[name]![0] * (1 - weight), clips[name]![1]]
    clips[clip] = [weight, actionTime(clip, timing, age)]
  }
  if (actor.hitFlashTicks > 0 || override === 'hit') {
    const age = Math.max(0, state.flashTicks - actor.hitFlashTicks)
    const weight = clamp(actor.hitFlashTicks / 2)
    for (const name of Object.keys(clips) as ClipName[]) clips[name] = [clips[name]![0] * (1 - weight), clips[name]![1]]
    clips.hit = [weight, mix(CLIP_MARKERS.hit.contact, CLIP_MARKERS.hit.end, clamp(age / state.flashTicks))]
  }
  return result
}
