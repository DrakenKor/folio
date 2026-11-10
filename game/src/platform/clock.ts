import { IDLE_COMMAND, Recorder, TICK_DT, step } from '../sim/core/index'
import type { Command, SimEvent, World } from '../sim/core/index'
import type { Frame, Pose } from '../render/view'

const STEP_MS = TICK_DT * 1000

/** Owns browser time, simulation steps and the replay recorder. */
export class Clock {
  readonly recorder: Recorder
  private previous = new Map<number, Pose>()
  private accumulator = 0
  private lastTime: number | undefined
  private explicitlyPaused = false
  private suspensions = new Set<string>()
  private frameTimes: number[] = []
  private tickTimes: number[][] = []
  private pendingTickTimes: number[] = []
  private events: SimEvent[] = []

  constructor(public world: World, private readCommand: (world: World) => Command = () => IDLE_COMMAND,
    private afterStep: (world: World) => void = () => {}) {
    this.recorder = new Recorder(world)
    this.capturePoses()
  }

  get paused(): boolean { return this.explicitlyPaused || this.suspensions.size > 0 }
  get userPaused(): boolean { return this.explicitlyPaused }

  pause(): void { this.explicitlyPaused = true; this.resetTime() }
  resume(): void { this.explicitlyPaused = false; this.resetTime() }

  suspend(reason: string, active: boolean): void {
    if (active) this.suspensions.add(reason)
    else this.suspensions.delete(reason)
    this.resetTime()
  }

  replace(world: World): void {
    this.world = world
    this.recorder.reset(world)
    this.events = []
    this.resetTime()
  }

  /** Manual steps also record commands, but do not draw or consume wall time. */
  advance(ticks: number, command?: Command): void {
    if (!Number.isSafeInteger(ticks) || ticks < 0) throw new RangeError('Ticks must be a nonnegative safe integer')
    for (let i = 0; i < ticks; i++) {
      this.capturePoses()
      const input = command ?? this.readCommand(this.world)
      const start = performance.now()
      this.events.push(...step(this.world, input))
      this.recorder.record(input)
      this.pendingTickTimes.push(performance.now() - start)
      this.afterStep(this.world)
    }
    if (this.paused) this.capturePoses()
  }

  frame(now: number): Frame {
    const elapsed = this.lastTime === undefined ? 0 : Math.max(0, now - this.lastTime)
    if (this.lastTime !== undefined) this.sample(this.frameTimes, elapsed)
    this.lastTime = now
    if (!this.paused) {
      this.accumulator += elapsed
      const available = Math.floor((this.accumulator + 1e-8) / STEP_MS)
      this.advance(Math.min(4, available))
      this.accumulator = Math.max(0, this.accumulator - available * STEP_MS)
    }
    const frame: Frame = { world: this.world, prev: this.previous,
      alpha: Math.min(this.accumulator / STEP_MS, 1 - Number.EPSILON), events: this.events }
    this.tickTimes.push(this.pendingTickTimes)
    this.pendingTickTimes = []
    if (this.tickTimes.length > 120) this.tickTimes.shift()
    this.events = []
    return frame
  }

  perf() {
    const summary = (values: number[]) => {
      const sorted = [...values].sort((a, b) => a - b)
      const at = (p: number) => sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)] ?? 0
      return { median: at(0.5), p95: at(0.95), samples: sorted.length }
    }
    return { frameMs: summary(this.frameTimes), tickMs: summary(this.tickTimes.flat()) }
  }

  private sample(values: number[], value: number): void {
    values.push(value)
    if (values.length > 120) values.shift()
  }

  private resetTime(): void {
    this.accumulator = 0
    this.lastTime = undefined
    this.capturePoses()
  }

  private capturePoses(): void {
    this.previous = new Map(this.world.entities.map(entity => [entity.id,
      { x: entity.pos.x, z: entity.pos.z, facing: entity.facing }]))
  }
}
