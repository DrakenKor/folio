import { restore } from '../sim/core'
import { GAIT, type ActionTiming } from '../sim/core/types'
import { actorPoseState, characterPose, type CharacterPose, type PoseState } from '../render/characters/pose'
import { CLIP_MARKERS, type ClipName } from '../render/characters/markers'
import { combatSnapshot } from './fixture'

const initial = restore(combatSnapshot())
const melee = initial.content.skills[0]!.timing
const projectile: ActionTiming = { windupTicks: 8, activeTicks: 1, recoveryTicks: 15, moveCancelTicks: 6 }

export function previewLength(clip: ClipName): number {
  if (clip.startsWith('attack')) return 21
  if (clip.startsWith('cast')) return 24
  if (clip === 'dodge') return 18
  if (clip === 'hit') return 6
  return Math.round(CLIP_MARKERS[clip].end * 60)
}

/** Debug states pass through the gameplay pose function, including explicit variant selection. */
export function previewState(clip: ClipName, age: number, facing = 0): PoseState {
  const actor = structuredClone(initial.entities[0]!)
  actor.facing = facing
  actor.aim = facing + Math.PI / 2
  const state = { ...actorPoseState(actor, initial), tick: age, clip }
  if (clip === 'walk' || clip === 'run') {
    actor.gait.speed = clip === 'walk' ? GAIT.walkSpeed : GAIT.runSpeed
    const stride = clip === 'walk' ? GAIT.walkStride : GAIT.runStride
    actor.gait.phase = age / 60 * actor.gait.speed / stride
  } else if (clip === 'death') actor.death = { startTick: 0, ageTicks: age, despawnAfterTicks: null }
  else if (clip === 'hit') actor.hitFlashTicks = Math.max(0, 6 - age)
  else if (clip.startsWith('attack') || clip.startsWith('cast') || clip === 'dodge') {
    const kind = clip === 'dodge' ? 'dodge' : clip.startsWith('cast') ? 'projectile' : 'melee'
    state.timing = kind === 'dodge' ? initial.content.dodge.timing : kind === 'melee' ? melee : projectile
    actor.action = { id: kind === 'dodge' ? 'dodge' : 'preview', kind, startTick: 0, ageTicks: age,
      direction: facing, hitTargetIds: [], projectileSpawned: false }
  }
  return state
}

export function previewPose(clip: ClipName, age: number, facing = 0): CharacterPose {
  return characterPose(previewState(clip, age, facing))
}
