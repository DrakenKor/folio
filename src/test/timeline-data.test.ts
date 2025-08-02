import { describe, it, expect, beforeEach } from 'vitest'
import { Vector3 } from 'three'
import { TimelineManager } from '../lib/timeline-manager'
import { ResumeDataLoader } from '../lib/resume-data-loader'
import { TimelinePositionCalculator } from '../lib/timeline-position-calculator'
import { TechCategory } from '../types/resume'

describe('Timeline Data Management', () => {
  let timelineManager: TimelineManager
  let resumeDataLoader: ResumeDataLoader

  beforeEach(() => {
    timelineManager = TimelineManager.getInstance()
    resumeDataLoader = ResumeDataLoader.getInstance()
    timelineManager.reset() // Reset for clean tests
  })

  describe('ResumeDataLoader', () => {
    it('should load resume data successfully', async () => {
      const resumeData = await resumeDataLoader.loadResumeData()

      expect(resumeData).toBeDefined()
      expect(resumeData.personal.name).toBe('Manav Dhindsa')
      expect(resumeData.experience).toHaveLength(5)
      expect(resumeData.skills).toHaveLength(4)
    })

    it('should return experiences sorted by date', async () => {
      const experiences = await resumeDataLoader.getExperiencesSorted()

      expect(experiences).toHaveLength(5)
      // Should be sorted newest first
      expect(experiences[0].company).toBe('Autify Inc')
      expect(experiences[experiences.length - 1].company).toBe('Phoenix Consulting')
    })

    it('should get skills by category', async () => {
      const frontendSkills = await resumeDataLoader.getSkillsByCategory(TechCategory.FRONTEND)

      expect(frontendSkills.length).toBeGreaterThan(0)
      expect(frontendSkills.every(skill => skill.category === TechCategory.FRONTEND)).toBe(true)
    })

    it('should get technologies for specific experience', async () => {
      const technologies = await resumeDataLoader.getTechnologiesForExperience('autify-2024')

      expect(technologies.length).toBeGreaterThan(0)
      expect(technologies.some(tech => tech.name === 'Golang')).toBe(true)
    })
  })

  describe('TimelinePositionCalculator', () => {
    it('should calculate timeline data with 3D positions', async () => {
      const resumeData = await resumeDataLoader.loadResumeData()
      const calculator = new TimelinePositionCalculator()

      const timelineData = calculator.calculateTimelineData(resumeData.experience)

      expect(timelineData.experiences).toHaveLength(5)
      expect(timelineData.helixConfig).toBeDefined()
      expect(timelineData.helixConfig.curve).toBeDefined()

      // Check that all experiences have 3D positions
      timelineData.experiences.forEach(exp => {
        expect(exp.position3D).toBeInstanceOf(Vector3)
        expect(exp.cardRotation).toBeInstanceOf(Vector3)
        expect(exp.timelineIndex).toBeGreaterThanOrEqual(0)
        expect(exp.normalizedTime).toBeGreaterThanOrEqual(0)
        expect(exp.normalizedTime).toBeLessThanOrEqual(1)
      })
    })

    it('should calculate positions along helix curve', async () => {
      const resumeData = await resumeDataLoader.loadResumeData()
      const calculator = new TimelinePositionCalculator()

      calculator.calculateTimelineData(resumeData.experience)

      const startPos = calculator.getPositionAtTime(0)
      const midPos = calculator.getPositionAtTime(0.5)
      const endPos = calculator.getPositionAtTime(1)

      expect(startPos).toBeInstanceOf(Vector3)
      expect(midPos).toBeInstanceOf(Vector3)
      expect(endPos).toBeInstanceOf(Vector3)

      // End position should be higher than start position
      expect(endPos.y).toBeGreaterThan(startPos.y)
    })

    it('should calculate camera positions', async () => {
      const resumeData = await resumeDataLoader.loadResumeData()
      const calculator = new TimelinePositionCalculator()

      const timelineData = calculator.calculateTimelineData(resumeData.experience)
      const cameraPositions = calculator.calculateCameraPositions(timelineData)

      expect(cameraPositions).toHaveLength(timelineData.experiences.length)
      cameraPositions.forEach(pos => {
        expect(pos).toBeInstanceOf(Vector3)
      })
    })
  })

  describe('TimelineManager', () => {
    it('should initialize timeline successfully', async () => {
      const timelineData = await timelineManager.initializeTimeline()

      expect(timelineData).toBeDefined()
      expect(timelineData.experiences).toHaveLength(5)
      expect(timelineManager.isInitialized()).toBe(true)
    })

    it('should get specific experience by ID', async () => {
      await timelineManager.initializeTimeline()

      const experience = await timelineManager.getExperience('autify-2024')

      expect(experience).toBeDefined()
      expect(experience?.company).toBe('Autify Inc')
      expect(experience?.position3D).toBeInstanceOf(Vector3)
    })

    it('should calculate timeline statistics', async () => {
      const stats = await timelineManager.getTimelineStats()

      expect(stats.totalExperiences).toBe(5)
      expect(stats.totalYears).toBeGreaterThan(7)
      expect(stats.technologiesUsed.length).toBeGreaterThan(10)
      expect(stats.companiesWorked).toContain('Autify Inc')
      expect(stats.companiesWorked).toContain('StaffLink')
    })

    it('should find nearest experience to position', async () => {
      await timelineManager.initializeTimeline()

      const testPosition = new Vector3(0, 10, 0)
      const nearestExp = await timelineManager.findNearestExperience(testPosition)

      expect(nearestExp).toBeDefined()
      expect(nearestExp?.position3D).toBeInstanceOf(Vector3)
    })

    it('should get experiences in radius', async () => {
      await timelineManager.initializeTimeline()

      const centerPosition = new Vector3(0, 25, 0) // Middle of timeline
      const experiencesInRadius = await timelineManager.getExperiencesInRadius(centerPosition, 20)

      expect(experiencesInRadius.length).toBeGreaterThan(0)
    })

    it('should get timeline bounds', async () => {
      const bounds = await timelineManager.getTimelineBounds()

      expect(bounds.min).toBeInstanceOf(Vector3)
      expect(bounds.max).toBeInstanceOf(Vector3)
      expect(bounds.center).toBeInstanceOf(Vector3)

      // Max should be greater than min in all dimensions
      expect(bounds.max.x).toBeGreaterThan(bounds.min.x)
      expect(bounds.max.y).toBeGreaterThan(bounds.min.y)
      expect(bounds.max.z).toBeGreaterThan(bounds.min.z)
    })

    it('should update configuration and recalculate', async () => {
      const originalData = await timelineManager.initializeTimeline()

      const newData = await timelineManager.updateConfiguration({
        startRadius: 15,
        totalHeight: 60
      })

      expect(newData).toBeDefined()
      expect(newData.experiences).toHaveLength(originalData.experiences.length)

      // Positions should be different due to configuration change
      const originalFirstPos = originalData.experiences[0].position3D
      const newFirstPos = newData.experiences[0].position3D

      expect(originalFirstPos.distanceTo(newFirstPos)).toBeGreaterThan(0)
    })
  })
})
