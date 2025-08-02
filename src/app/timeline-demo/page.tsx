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
    <div className="min-h-screen bg-gray-950 py-8">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-4">
              3D Interactive Resume Timeline
            </h1>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              Navigate through my professional journey in an immersive 3D helix visualization.
              Experience interactive career progression with smooth camera transitions and detailed experience cards.
            </p>
          </div>

          {/* Controls Panel */}
          <div className="bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
            <h2 className="text-2xl font-bold mb-4 text-white">Timeline Controls</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Quality Settings */}
              <div>
                <label className="block text-white text-sm font-medium mb-2">
                  Quality Level
                </label>
                <select
                  value={qualityLevel}
                  onChange={(e) => handleQualityChange(e.target.value as QualityLevel)}
                  className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm border border-gray-600 focus:border-blue-500 focus:outline-none"
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
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600 border border-gray-600'
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
                  className="w-full accent-blue-500"
                />
              </div>

              {/* Reset Camera */}
              <div>
                <label className="block text-white text-sm font-medium mb-2">
                  Camera Control
                </label>
                <button
                  onClick={resetCamera}
                  className="w-full bg-gray-700 text-gray-300 hover:bg-gray-600 px-3 py-2 rounded text-sm font-medium transition-colors border border-gray-600"
                >
                  Reset View
                </button>
              </div>
            </div>
          </div>

          {/* Timeline Stats */}
          {timelineData && <TimelineStats />}

          {/* 3D Timeline Visualization */}
          <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden mb-8">
            <div className="relative h-[600px]">
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

          {/* Technical Implementation */}
          <div className="bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
            <h2 className="text-2xl font-bold mb-4 text-white">
              Technical Implementation
            </h2>
            <div className="space-y-4 text-gray-300">
              <div>
                <h3 className="font-semibold text-lg mb-2 text-gray-100">
                  3D Visualization Features
                </h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Interactive 3D helix timeline with smooth camera transitions</li>
                  <li>Dynamic experience cards with detailed information panels</li>
                  <li>Particle system connecting timeline experiences</li>
                  <li>Adaptive quality settings for optimal performance</li>
                  <li>Auto-navigation with configurable speed controls</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-2 text-gray-100">
                  Performance Optimizations
                </h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Three.js WebGL rendering with efficient geometry management</li>
                  <li>Smooth camera interpolation</li>
                  <li>Memory-efficient particle systems with object pooling</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-2 text-gray-100">
                  Interactive Controls
                </h3>
                <p className="ml-4">
                  The timeline supports both manual navigation through experience selection
                  and automated touring with adjustable speed. Camera positioning is
                  calculated to provide optimal viewing angles for each experience card.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-blue-900 border border-blue-700 rounded-lg p-6">
            <h3 className="text-blue-100 font-semibold mb-2">
              Try These Features
            </h3>
            <ul className="text-blue-200 space-y-1">
              <li>• Click on experience cards to navigate directly to them</li>
              <li>• Use auto-navigation to tour through the entire timeline</li>
              <li>• Adjust quality settings based on your device performance</li>
              <li>• Reset camera view to return to the overview perspective</li>
            </ul>
          </div>
        </div>
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
    <div className="bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
      <h3 className="text-2xl font-bold mb-4 text-white">Timeline Overview</h3>
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
    <div className="absolute top-4 right-4 bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-6 max-w-md text-white">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-xl font-bold">{experience.company}</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors text-lg"
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
          <p className="text-sm text-gray-300">{experience.description}</p>
        </div>

        <div>
          <h5 className="font-medium text-green-400 mb-2">Technologies</h5>
          <div className="flex flex-wrap gap-2">
            {experience.technologies.map((tech, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-blue-600/20 text-blue-300 rounded text-xs border border-blue-600/30"
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
