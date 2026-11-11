// The contract between the simulation and everything that draws it. Owned by
// the orchestrator.
import type { EntityId, SimEvent, World } from '../sim/core/types'

/** Where an entity was at the end of the previous tick. */
export interface Pose {
  x: number
  z: number
  facing: number
}

export interface Frame {
  world: Readonly<World>
  /** Poses at the previous tick, for interpolation. Missing ids have just spawned. */
  prev: ReadonlyMap<EntityId, Pose>
  /** Fraction of a tick since `world.tick`, in [0, 1). */
  alpha: number
  /** Events from ticks stepped since the last frame. */
  events: readonly SimEvent[]
}

/**
 * A view reads frames and never writes simulation state. Animation time comes
 * from simulation-owned action age and gait phase. Hit-stop can separate action
 * age from elapsed world ticks; startTick alone cannot drive combat animation.
 */
export interface RenderView {
  sync(frame: Frame): void
  render(): void
  resize(width: number, height: number, pixelRatio: number): void
  dispose(): void
}
