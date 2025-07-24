import { Vector3 } from 'three'
import { ResumeDataLoader } from './resume-data-loader'
import { TimelinePositionCalculator } from './timeline-position-calculator'
import {
  TimelineData,
  TimelineExperience,
  Experience,
  TimelineCalculationConfig
} from '../types/resume'

/**
 * Timeline Manager
 * Orchestrates resume data loading and timeline position calculation
 */
export class TimelineManager {
  private static instance: TimelineManager
  private dataLoader: ResumeDataLoader
  private positionCalculator: TimelinePositionCalculator
  private timelineData: TimelineData | null = null
  private isLoading = false

  private constructor() {
    this.dataLoader = ResumeDataLoader.getInstance()
    this.positionCalculator = new TimelinePositionCalculator()
  }

  public static getInstance(): TimelineManager {
    if (!TimelineManager.instance) {
      TimelineManager.instance = new TimelineManager()
    }
    return TimelineManager.instance
  }

  /**
   * Initialize timeline with resume data and calculate positions
   */
  public async initializeTimeline(config?: Partial<TimelineCalculationConfig>): Promise<TimelineData> {
    if (this.timelineData && !config) {
      return this.timelineData
    }

    if (this.isLoading) {
      // Wait for existing loading to complete
      while (this.isLoading) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      return this.timelineData!
    }

    try {
      this.isLoading = true

      // Update configuration if provided
      if (config) {
        this.positionCalculator.updateConfig(config)
      }

      // Load resume data
      const resumeData = await this.dataLoader.loadResumeData()

      // Calculate timeline positions
      this.timelineData = this.positionCalculator.calculateTimelineData(resumeData.experience)

      return this.timelineData
    } catch (error) {
      console.error('Failed to initialize timeline:', error)
      throw new Error('Timeline initialization failed')
    } finally {
      this.isLoading = false
    }
  }

  /**
   * Get timeline data (initialize if not already done)
   */
  public async getTimelineData(): Promise<TimelineData> {
    if (!this.timelineData) {
      return this.initializeTimeline()
    }
    return this.timelineData
  }

  /**
   * Get specific experience by ID with 3D position data
   */
  public async getExperience(experienceId: string): Promise<TimelineExperience | null> {
    const timeline = await this.getTimelineData()
    return timeline.experiences.find(exp => exp.id === experienceId) || null
  }

  /**
   * Get all experiences sorted by timeline position
   */
  public async getExperiencesSorted(): Promise<TimelineExperience[]> {
    const timeline = await this.getTimelineData()
    return [...timeline.experiences].sort((a, b) => a.timelineIndex - b.timelineIndex)
  }

  /**
   * Get camera position for viewing a specific experience
   */
  public async getCameraPositionForExperience(experienceId: string): Promise<Vector3 | null> {
    const experience = await this.getExperience(experienceId)
    if (!experience) return null

    const timeline = await this.getTimelineData()
    const cameraPositions = this.positionCalculator.calculateCameraPositions(timeline)

    return cameraPositions[experience.timelineIndex] || null
  }

  /**
   * Get position along timeline curve at normalized time (0-1)
   */
  public async getPositionAtTime(t: number): Promise<Vector3> {
    await this.getTimelineData() // Ensure timeline is initialized
    return this.positionCalculator.getPositionAtTime(t)
  }

  /**
   * Get tangent direction at normalized time (0-1)
   */
  public async getTangentAtTime(t: number): Promise<Vector3> {
    await this.getTimelineData() // Ensure timeline is initialized
    return this.positionCalculator.getTangentAtTime(t)
  }

  /**
   * Get timeline bounds for camera constraints
   */
  public async getTimelineBounds(): Promise<{
    min: Vector3
    max: Vector3
    center: Vector3
  }> {
    const timeline = await this.getTimelineData()
    return this.positionCalculator.getTimelineBounds(timeline)
  }

  /**
   * Get optimal viewing distance for the timeline
   */
  public async getOptimalViewingDistance(): Promise<number> {
    const timeline = await this.getTimelineData()
    return this.positionCalculator.calculateOptimalViewingDistance(timeline)
  }

  /**
   * Find nearest experience to a 3D position
   */
  public async findNearestExperience(position: Vector3): Promise<TimelineExperience | null> {
    const timeline = await this.getTimelineData()
    let nearestExperience: TimelineExperience | null = null
    let minDistance = Infinity

    for (const experience of timeline.experiences) {
      const distance = position.distanceTo(experience.position3D)
      if (distance < minDistance) {
        minDistance = distance
        nearestExperience = experience
      }
    }

    return nearestExperience
  }

  /**
   * Get experiences within a certain radius of a position
   */
  public async getExperiencesInRadius(
    position: Vector3,
    radius: number
  ): Promise<TimelineExperience[]> {
    const timeline = await this.getTimelineData()

    return timeline.experiences.filter(experience =>
      position.distanceTo(experience.position3D) <= radius
    )
  }

  /**
   * Get timeline statistics
   */
  public async getTimelineStats(): Promise<{
    totalExperiences: number
    totalYears: number
    averageJobDuration: number
    technologiesUsed: string[]
    companiesWorked: string[]
  }> {
    const timeline = await this.getTimelineData()
    const experiences = timeline.experiences

    const totalYears = (timeline.endDate.getTime() - timeline.startDate.getTime()) /
      (1000 * 60 * 60 * 24 * 365.25)

    const jobDurations = experiences.map(exp => {
      const endDate = exp.endDate || new Date()
      return (endDate.getTime() - exp.startDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
    })

    const averageJobDuration = jobDurations.reduce((sum, duration) => sum + duration, 0) /
      jobDurations.length

    const techSet = new Set(experiences.flatMap(exp => exp.technologies))
    const technologiesUsed = Array.from(techSet).sort()

    const companySet = new Set(experiences.map(exp => exp.company))
    const companiesWorked = Array.from(companySet).sort()

    return {
      totalExperiences: experiences.length,
      totalYears: Math.round(totalYears * 10) / 10,
      averageJobDuration: Math.round(averageJobDuration * 10) / 10,
      technologiesUsed,
      companiesWorked
    }
  }

  /**
   * Update timeline configuration and recalculate
   */
  public async updateConfiguration(config: Partial<TimelineCalculationConfig>): Promise<TimelineData> {
    this.positionCalculator.updateConfig(config)
    this.timelineData = null // Force recalculation
    return this.initializeTimeline()
  }

  /**
   * Reset timeline data (force reload on next access)
   */
  public reset(): void {
    this.timelineData = null
  }

  /**
   * Check if timeline is initialized
   */
  public isInitialized(): boolean {
    return this.timelineData !== null
  }

  /**
   * Get loading state
   */
  public isTimelineLoading(): boolean {
    return this.isLoading
  }
}
