'use client'

import React, { useState } from 'react'
import Timeline3D from '../../components/Timeline3D'
import { useTimeline3D } from '../../hooks/useTimeline3D'
import { QualityLevel } from '../../types'
import { TimelineExperience } from '../../types/resume'

/**
 * Timeline Demo Page
 * Demonstrates the 3D helical timeline visualization
 */
export default function TimelineDemoPage() {
  const [qualityLevel, setQualityLevel] = useState<QualityLevel>(QualityLevel.HIGH)
  const [autoNavigate, setAutoNavigate] = useState(false)
  const [navigationSpeed, setNavigationSpeed] = useState(0.1)
  const [selectedExperience, setSelectedExperience] = useState<TimelineExperience | null>(null)

  const {
    timelineData,
    isLoading,
    error,
    currentExperience,
    isAutoNavigating,
    navigateToExperience,
    startAutoNavigation,
    stopAutoNavigation,
    setNavigationSpeed: setHookNavigationSpeed,
    resetCamera,
    getTimelineStats
  } = useTimeline3D()

  const handleExperienceSelect = (experience: TimelineExperience) => {
    setSelectedExperience(experience)
    // Only navigate manually if not auto-navigating
    if (!autoNavigate) {
      navigateToExperience(experience.id)
    }
  }

  const handleAutoNavigationToggle = () => {
    if (autoNavigate) {
      // Stop auto-navigation
      setAutoNavigate(false)
    } else {
      // Start auto-navigation
      setAutoNavigate(true)
    }
  }

  const handleSpeedChange = (speed: number) => {
    setNavigationSpeed(speed)
    setHookNavigationSpeed(speed)
  }

  const handleQualityChange = (quality: QualityLevel) => {
    setQualityLevel(quality)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
      {/* Header */}
      <div className="relative z-10 p-6">
        <h1 className="text-4xl font-bold text-white mb-2">
          3D Interactive Resume Timeline
        </h1>
        <p className="text-gray-300 mb-6">
          Navigate through my professional journey in an immersive 3D helix visualization
        </p>

        {/* Controls Panel */}
        <div className="bg-black/20 backdrop-blur-sm rounded-lg p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Quality Settings */}
            <div>
              <label className="block text-white text-sm font-medium mb-2">
                Quality Level
              </label>
              <select
                value={qualityLevel}
                onChange={(e) => handleQualityChange(e.target.value as QualityLevel)}
                className="w-full bg-white/10 text-white rounded px-3 py-2 text-sm"
              >
                <option value={QualityLevel.LOW}>Low</option>
                <option value={QualityLevel.MEDIUM}>Medium</option>
                <option value={QualityLevel.HIGH}>High</option>
                <option value={QualityLevel.ULTRA}>Ultra</option>
              </select>
            </div>

            {/* Auto Navigation */}
            <div>
              <label className="block text-white text-sm font-medium mb-2">
                Auto Navigation
              </label>
              <button
                onClick={handleAutoNavigationToggle}
                className={`w-full px-3 py-2 rounded text-sm font-medium transition-colors ${
                  autoNavigate
                    ? 'bg-blue-500 text-white'
                    : 'bg-white/10 text-gray-300 hover:bg-white/20'
                }`}
              >
                {autoNavigate ? 'Stop Auto' : 'Start Auto'}
              </button>
            </div>

            {/* Navigation Speed */}
            <div>
              <label className="block text-white text-sm font-medium mb-2">
                Speed: {navigationSpeed.toFixed(2)}
              </label>
              <input
                type="range"
                min="0.01"
                max="0.5"
                step="0.01"
                value={navigationSpeed}
                onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>

            {/* Reset Camera */}
            <div>
              <label className="block text-white text-sm font-medium mb-2">
                Camera Control
              </label>
              <button
                onClick={resetCamera}
                className="w-full bg-white/10 text-gray-300 hover:bg-white/20 px-3 py-2 rounded text-sm font-medium transition-colors"
              >
                Reset View
              </button>
            </div>
          </div>
        </div>

        {/* Timeline Stats */}
        {timelineData && (
          <TimelineStats />
        )}
      </div>

      {/* 3D Timeline Visualization */}
      <div className="relative h-screen">
        <Timeline3D
          qualityLevel={qualityLevel}
          autoNavigate={autoNavigate}
          navigationSpeed={navigationSpeed}
          onExperienceSelect={handleExperienceSelect}
          className="absolute inset-0"
        />

        {/* Experience Details Panel */}
        {selectedExperience && (
          <ExperienceDetailsPanel
            experience={selectedExperience}
            onClose={() => setSelectedExperience(null)}
          />
        )}

        {/* Loading/Error States */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="text-center text-white">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p>Loading 3D Timeline...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="text-center text-red-400">
              <p className="text-lg font-semibold mb-2">Error</p>
              <p>{error}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Timeline Statistics Component
 */
const TimelineStats: React.FC = () => {
  const { getTimelineStats } = useTimeline3D()
  const [stats, setStats] = useState<{
    totalExperiences: number
    totalYears: number
    averageJobDuration: number
    technologiesUsed: string[]
    companiesWorked: string[]
  } | null>(null)

  React.useEffect(() => {
    const loadStats = async () => {
      const timelineStats = await getTimelineStats()
      setStats(timelineStats)
    }
    loadStats()
  }, [getTimelineStats])

  if (!stats) return null

  return (
    <div className="bg-black/20 backdrop-blur-sm rounded-lg p-4 mb-6">
      <h3 className="text-white font-semibold mb-3">Timeline Overview</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
        <div>
          <div className="text-2xl font-bold text-blue-400">{stats.totalExperiences}</div>
          <div className="text-sm text-gray-300">Experiences</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-green-400">{stats.totalYears}</div>
          <div className="text-sm text-gray-300">Years</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-purple-400">{stats.technologiesUsed.length}</div>
          <div className="text-sm text-gray-300">Technologies</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-orange-400">{stats.companiesWorked.length}</div>
          <div className="text-sm text-gray-300">Companies</div>
        </div>
      </div>
    </div>
  )
}

/**
 * Experience Details Panel Component
 */
interface ExperienceDetailsPanelProps {
  experience: TimelineExperience
  onClose: () => void
}

const ExperienceDetailsPanel: React.FC<ExperienceDetailsPanelProps> = ({
  experience,
  onClose
}) => {
  return (
    <div className="absolute top-4 right-4 bg-black/80 backdrop-blur-sm rounded-lg p-6 max-w-md text-white">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-xl font-bold">{experience.company}</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors"
        >
          ✕
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <h4 className="font-semibold text-blue-400">{experience.position}</h4>
          <p className="text-sm text-gray-300">
            {experience.startDate.getFullYear()} - {experience.endDate?.getFullYear() || 'Present'}
          </p>
          <p className="text-sm text-gray-300">{experience.location}</p>
        </div>

        <div>
          <p className="text-sm">{experience.description}</p>
        </div>

        <div>
          <h5 className="font-medium text-green-400 mb-2">Technologies</h5>
          <div className="flex flex-wrap gap-2">
            {experience.technologies.map((tech, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>

        <div>
          <h5 className="font-medium text-purple-400 mb-2">Key Achievements</h5>
          <ul className="text-sm space-y-1">
            {experience.achievements.slice(0, 3).map((achievement, index) => (
              <li key={index} className="text-gray-300">
                • {achievement}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
