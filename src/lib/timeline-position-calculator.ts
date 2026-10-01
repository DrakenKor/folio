import { Vector3 } from 'three'
import { Experience } from '../types/resume'

const DAY_MS = 86_400_000
const YEAR_MS = 365.25 * DAY_MS

export interface HelixConfig {
  startRadius: number
  endRadius: number
  // One turn per this many years
  yearsPerTurn: number
  heightPerYear: number
}

export interface TimelineStats {
  roles: number
  years: number
  companies: number
  technologies: number
}

// A role with no end date is still running, so it ends today
export const roleEnd = (role: Experience, today: Date): Date => role.endDate ?? today

/**
 * The numbers the ledger shows, all computed from the data: the span runs from
 * the first start to the last end.
 */
export function timelineStats(roles: Experience[], today: Date): TimelineStats {
  const starts = roles.map(role => role.startDate.getTime())
  const ends = roles.map(role => roleEnd(role, today).getTime())
  return {
    roles: roles.length,
    years: roles.length ? (Math.max(...ends) - Math.min(...starts)) / YEAR_MS : 0,
    companies: new Set(roles.map(role => role.company)).size,
    technologies: new Set(roles.flatMap(role => role.technologies)).size
  }
}

// Every January 1st from the start's year to the end's year
export function januaries(start: Date, end: Date): Date[] {
  const years: Date[] = []
  for (let year = start.getUTCFullYear(); year <= end.getUTCFullYear(); year++) {
    years.push(new Date(Date.UTC(year, 0, 1)))
  }
  return years
}

/**
 * Timeline Position Calculator
 * A helix whose height and angle are set by date: one turn per three years,
 * the radius widening from start to end. A four-year role covers four times
 * the arc of a one-year role.
 */
export class TimelinePositionCalculator {
  public readonly config: HelixConfig
  private readonly startMs: number
  private readonly spanMs: number

  constructor(
    public readonly start: Date,
    public readonly end: Date,
    config?: Partial<HelixConfig>
  ) {
    this.config = { startRadius: 8, endRadius: 12, yearsPerTurn: 3, heightPerYear: 5, ...config }
    this.startMs = start.getTime()
    this.spanMs = Math.max(1, end.getTime() - this.startMs)
  }

  public get years(): number {
    return this.spanMs / YEAR_MS
  }

  public get height(): number {
    return this.years * this.config.heightPerYear
  }

  /** 0 at the start of the timeline, 1 at the end. Dates outside it clamp. */
  public paramAtDate(date: Date | number): number {
    const ms = typeof date === 'number' ? date : date.getTime()
    return Math.max(0, Math.min(1, (ms - this.startMs) / this.spanMs))
  }

  public pointAtParam(t: number, target = new Vector3()): Vector3 {
    const { startRadius, endRadius, yearsPerTurn } = this.config
    const angle = (this.years / yearsPerTurn) * Math.PI * 2 * t
    const radius = startRadius + (endRadius - startRadius) * t
    return target.set(Math.cos(angle) * radius, t * this.height, Math.sin(angle) * radius)
  }

  public pointAtDate(date: Date | number, target = new Vector3()): Vector3 {
    return this.pointAtParam(this.paramAtDate(date), target)
  }
}
