import { Vector3, CatmullRomCurve3 } from 'three'
import {
  Experience,
  TimelineData,
  TimelineExperience,
  HelixConfig,
  TimelinePosition,
  TimelineCalculationConfig
} from '../types/resume'

/**
 * Timeline Position Calculator
 * Calculates 3D positions for experiences along a helical timeline
 */
export class TimelinePositionCalculator {
  private config: TimelineCalculationConfig
  private helixCurve: CatmullRomCurve3 | null = null

  constructor(config?: Partial<TimelineCalculationConfig>) {
    this.config = {
      startRadius: 8,
      endRadius: 12,
      totalHeight: 50,
      helixTurns: 3,
      experienceSpacing: 0.8,
      verticalOffset: 0,
      ...config
    }
  }

  /**
   * Calculate timeline data with 3D positions for all experiences
   */
  public calculateTimelineData(experiences: Experience[]): TimelineData {
    // Sort experiences by start date (oldest first for timeline)
    const sortedExperiences = [...experiences].sort((a, b) =>
      a.startDate.getTime() - b.startDate.getTime()
    )

    const startDate = sortedExperiences[0]?.startDate || new Date()
    const endDate = sortedExperiences[sortedExperiences.length - 1]?.endDate || new Date()
    const totalDuration = endDate.getTime() - startDate.getTime()

    // Generate helix curve points
    const helixPoints = this.generateHelixPoints(sortedExperiences.length)
    this.helixCurve = new CatmullRomCurve3(helixPoints)

    // Calculate positions for each experience
    const timelineExperiences: TimelineExperience[] = sortedExperiences.map((experience, index) => {
      const normalizedTime = this.calculateNormalizedTime(experience, startDate, totalDuration)
      const position3D = this.calculatePosition3D(index, sortedExperiences.length)
      const cardRotation = this.calculateCardRotation(index, sortedExperiences.length)
      const connectionPoints = this.calculateConnectionPoints(index, sortedExperiences.length)

      return {
        ...experience,
        position3D,
        timelineIndex: index,
        normalizedTime,
        cardRotation,
        connectionPoints
      }
    })

    const helixConfig: HelixConfig = {
      radius: this.config.startRadius,
      height: this.config.totalHeight,
      turns: this.config.helixTurns,
      segments: sortedExperiences.length * 4,
      curve: this.helixCurve
    }

    return {
      experiences: timelineExperiences,
      totalDuration,
      startDate,
      endDate,
      helixConfig
    }
  }

  /**
   * Generate points for the helix curve
   */
  private generateHelixPoints(experienceCount: number): Vector3[] {
    const points: Vector3[] = []
    const segmentCount = Math.max(experienceCount * 4, 20) // Ensure smooth curve

    for (let i = 0; i <= segmentCount; i++) {
      const t = i / segmentCount
      const angle = t * Math.PI * 2 * this.config.helixTurns

      // Gradually increase radius as we go up
      const radius = this.config.startRadius +
        (this.config.endRadius - this.config.startRadius) * t

      const x = Math.cos(angle) * radius
      const z = Math.sin(angle) * radius
      const y = t * this.config.totalHeight + this.config.verticalOffset

      points.push(new Vector3(x, y, z))
    }

    return points
  }

  /**
   * Calculate normalized time (0-1) for an experience on the timeline
   */
  private calculateNormalizedTime(
    experience: Experience,
    startDate: Date,
    totalDuration: number
  ): number {
    const experienceStart = experience.startDate.getTime() - startDate.getTime()
    return Math.max(0, Math.min(1, experienceStart / totalDuration))
  }

  /**
   * Calculate 3D position for an experience along the helix
   */
  private calculatePosition3D(index: number, totalCount: number): Vector3 {
    const t = index / Math.max(1, totalCount - 1)
    const angle = t * Math.PI * 2 * this.config.helixTurns

    // Gradually increase radius
    const radius = this.config.startRadius +
      (this.config.endRadius - this.config.startRadius) * t

    const x = Math.cos(angle) * radius
    const z = Math.sin(angle) * radius
    const y = t * this.config.totalHeight + this.config.verticalOffset

    return new Vector3(x, y, z)
  }

  /**
   * Calculate card rotation to face directly toward helix center (no variation)
   */
  private calculateCardRotation(index: number, totalCount: number): Vector3 {
    const t = index / Math.max(1, totalCount - 1)
    const angle = t * Math.PI * 2 * this.config.helixTurns

    // All cards face directly toward the center - no variation at all
    const rotationY = index % 2 === 0 ? angle + Math.PI : angle

    return new Vector3(
      0, // No X rotation variation
      rotationY, // Direct face-center rotation
      0 // No Z rotation variation
    )
  }

  /**
   * Calculate connection points for particle trails between experiences
   */
  private calculateConnectionPoints(index: number, totalCount: number): Vector3[] {
    const points: Vector3[] = []

    if (index === 0) return points // First experience has no previous connection

    const currentPos = this.calculatePosition3D(index, totalCount)
    const previousPos = this.calculatePosition3D(index - 1, totalCount)

    // Create intermediate points for smooth particle trail
    const segmentCount = 8
    for (let i = 0; i <= segmentCount; i++) {
      const t = i / segmentCount
      const point = new Vector3().lerpVectors(previousPos, currentPos, t)

      // Add slight curve to the connection
      const midPoint = t === 0.5
      if (midPoint) {
        point.y += 1 // Slight upward curve at midpoint
      }

      points.push(point)
    }

    return points
  }

  /**
   * Get position along the helix curve at a specific time (0-1)
   */
  public getPositionAtTime(t: number): Vector3 {
    if (!this.helixCurve) {
      throw new Error('Timeline data must be calculated first')
    }

    const clampedT = Math.max(0, Math.min(1, t))
    return this.helixCurve.getPoint(clampedT)
  }

  /**
   * Get tangent direction along the helix curve at a specific time
   */
  public getTangentAtTime(t: number): Vector3 {
    if (!this.helixCurve) {
      throw new Error('Timeline data must be calculated first')
    }

    const clampedT = Math.max(0, Math.min(1, t))
    return this.helixCurve.getTangent(clampedT).normalize()
  }

  /**
   * Calculate camera positions for smooth navigation along timeline
   */
  public calculateCameraPositions(timelineData: TimelineData): Vector3[] {
    const cameraPositions: Vector3[] = []

    timelineData.experiences.forEach((experience, index) => {
      const experiencePos = experience.position3D
      const tangent = this.getTangentAtTime(experience.normalizedTime)

      // Position camera at a distance from the experience, looking at it
      const cameraDistance = 15
      const cameraOffset = new Vector3()
        .crossVectors(tangent, new Vector3(0, 1, 0))
        .normalize()
        .multiplyScalar(cameraDistance)

      const cameraPos = experiencePos.clone().add(cameraOffset)
      cameraPos.y += 5 // Slightly above the experience

      cameraPositions.push(cameraPos)
    })

    return cameraPositions
  }

  /**
   * Update configuration and recalculate if needed
   */
  public updateConfig(newConfig: Partial<TimelineCalculationConfig>): void {
    this.config = { ...this.config, ...newConfig }
    this.helixCurve = null // Force recalculation
  }

  /**
   * Get the current configuration
   */
  public getConfig(): TimelineCalculationConfig {
    return { ...this.config }
  }

  /**
   * Calculate optimal viewing distance based on timeline size
   */
  public calculateOptimalViewingDistance(timelineData: TimelineData): number {
    const maxRadius = Math.max(this.config.startRadius, this.config.endRadius)
    const height = this.config.totalHeight

    // Calculate distance that shows the entire timeline comfortably
    return Math.max(maxRadius * 2.5, height * 0.8)
  }

  /**
   * Get timeline bounds for camera constraints
   */
  public getTimelineBounds(timelineData: TimelineData): {
    min: Vector3
    max: Vector3
    center: Vector3
  } {
    const maxRadius = Math.max(this.config.startRadius, this.config.endRadius)

    const min = new Vector3(
      -maxRadius - 5,
      this.config.verticalOffset - 5,
      -maxRadius - 5
    )

    const max = new Vector3(
      maxRadius + 5,
      this.config.verticalOffset + this.config.totalHeight + 5,
      maxRadius + 5
    )

    const center = new Vector3().addVectors(min, max).multiplyScalar(0.5)

    return { min, max, center }
  }
}
