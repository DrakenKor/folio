import { describe, it, expect } from 'vitest'
import { ResumeDataLoader } from '../lib/resume-data-loader'
import { TimelinePositionCalculator, roleEnd, timelineStats } from '../lib/timeline-position-calculator'

const roles = ResumeDataLoader.getInstance().getExperiencesOldestFirst()
const today = new Date('2026-10-01')
const calculator = new TimelinePositionCalculator(roles[0].startDate, today)

describe('Career timeline data', () => {
  it('loads six roles oldest first, and the helix rises with date', () => {
    expect(roles).toHaveLength(6)
    expect(roles.map(role => role.company)[0]).toBe('Phoenix Consulting')
    const starts = roles.map(role => role.startDate.getTime())
    expect(starts).toEqual([...starts].sort((a, b) => a - b))

    const heights = roles.map(role => calculator.pointAtDate(role.startDate).y)
    expect(heights).toEqual([...heights].sort((a, b) => a - b))
    // Arc is proportional to duration: four years against one
    const span = (index: number) => calculator.paramAtDate(roles[index + 1].startDate) - calculator.paramAtDate(roles[index].startDate)
    expect(span(1) / span(0)).toBeCloseTo(4, 1)
  })

  it('ends a role with no end date at today', () => {
    const current = roles.find(role => role.endDate === null)!
    expect(roleEnd(current, today)).toBe(today)
  })

  it('counts two roles at one company as one company', () => {
    expect(roles.filter(role => role.company === 'Rezinaus')).toHaveLength(2)
    const stats = timelineStats(roles, today)
    expect(stats.companies).toBe(new Set(roles.map(role => role.company)).size)
    expect(stats.companies).toBe(roles.length - 1)
    expect(stats.roles).toBe(6)
    expect(stats.years).toBeCloseTo(9.75, 1)
  })

  it('clamps dates before the first role and after today to the ends', () => {
    const first = calculator.pointAtDate(roles[0].startDate)
    const last = calculator.pointAtDate(today)
    expect(calculator.pointAtDate(new Date('2000-01-01')).equals(first)).toBe(true)
    expect(calculator.pointAtDate(new Date('2040-01-01')).equals(last)).toBe(true)
  })
})
