'use client'

import React, { useRef, useEffect, useState, useCallback } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import * as THREE from 'three'
import { TimelineScene3D } from './scenes/TimelineScene3D'
import { SceneManager } from '../lib/scene-management/SceneManager'
import { QualityLevel, SectionType } from '../types'
import { TimelineManager } from '../lib/timeline-manager'
import { TimelineExperience } from '../types/resume'

interface Timeline3DProps {
  qualityLevel?: QualityLevel
  autoNavigate?: boolean
  navigationSpeed?: number
  onExperienceSelect?: (experience: TimelineExperience) => void
  className?: string
}

/**
 * Timeline3D Component
 * Renders the 3D helical timeline with experience cards and smooth camera movement
 */
export const Timeline3D: React.FC<Timeline3DProps> = ({
  qualityLevel = QualityLevel.HIGH,
  autoNavigate = false,
  navigationSpeed = 0.1,
  onExperienceSelect,
  className = ''
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [experiences, setExperiences] = useState<TimelineExperience[]>([])
  const [currentSelectedExperience, setCurrentSelectedExperience] = useState<string | null>(null)

  // Reference to access the timeline scene for camera control
  const timelineSceneRef = useRef<any>(null)
  const orbitControlsRef = useRef<any>(null)

  // Wrapper function to update timeline controls, animate camera, and call parent callback
  const handleExperienceSelection = useCallback((experience: TimelineExperience) => {
    console.log('Experience selected:', experience.company, 'Auto-navigate:', autoNavigate)
    setCurrentSelectedExperience(experience.id)

    // Only animate camera if auto-navigation is not active
    if (!autoNavigate && timelineSceneRef.current) {
      console.log('Attempting to navigate to experience:', experience.id)
      console.log('Timeline scene ref:', timelineSceneRef.current)

      // Stop auto-navigation first to ensure manual navigation works
      timelineSceneRef.current.stopAutoNavigation()

      // Trigger smooth camera animation to the selected experience
      timelineSceneRef.current.navigateToExperience(experience.id)
    } else if (autoNavigate) {
      console.log('Auto-navigation is active, skipping manual camera move')
    } else {
      console.log('Timeline scene ref is null')
    }

    onExperienceSelect?.(experience)
  }, [onExperienceSelect, autoNavigate])

  // Load timeline data
  useEffect(() => {
    const loadTimelineData = async () => {
      try {
        setIsLoading(true)
        const timelineManager = TimelineManager.getInstance()
        const timelineData = await timelineManager.initializeTimeline()
        setExperiences(timelineData.experiences)
        setError(null)
      } catch (err) {
        console.error('Failed to load timeline data:', err)
        setError('Failed to load timeline data')
      } finally {
        setIsLoading(false)
      }
    }

    loadTimelineData()
  }, [])

  // Pass OrbitControls ref to scene when available
  useEffect(() => {
    if (timelineSceneRef.current && orbitControlsRef.current) {
      (timelineSceneRef.current as any).setOrbitControlsRef(orbitControlsRef.current)
    }
  }, [timelineSceneRef.current, orbitControlsRef.current])

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading timeline...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-center text-red-500">
          <p className="text-lg font-semibold mb-2">Error</p>
          <p>{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className={`relative w-full h-full ${className}`}>
      <Canvas
        camera={{ position: [30, 25, 30], fov: 60 }}
        gl={{
          antialias: qualityLevel !== QualityLevel.LOW,
          alpha: true,
          powerPreference: 'high-performance'
        }}
        shadows={qualityLevel === QualityLevel.HIGH || qualityLevel === QualityLevel.ULTRA}
      >
        <TimelineScene
          qualityLevel={qualityLevel}
          autoNavigate={autoNavigate}
          navigationSpeed={navigationSpeed}
          onExperienceSelect={handleExperienceSelection}
          parentTimelineSceneRef={timelineSceneRef}
        />
         <OrbitControls
          ref={orbitControlsRef}
          enabled={!autoNavigate}
          enablePan={!autoNavigate}
          enableZoom={!autoNavigate}
          enableRotate={!autoNavigate}
          minDistance={10}
          maxDistance={100}
          minPolarAngle={0}
          maxPolarAngle={Math.PI}
        />
      </Canvas>

      {/* Timeline Controls */}
      <TimelineControls
        experiences={experiences}
        selectedExperience={currentSelectedExperience}
        onExperienceSelect={handleExperienceSelection}
      />
    </div>
  )
}

/**
 * Timeline Scene Component (inside Canvas)
 */
interface TimelineSceneProps {
  qualityLevel: QualityLevel
  autoNavigate: boolean
  navigationSpeed: number
  onExperienceSelect?: (experience: TimelineExperience) => void
  parentTimelineSceneRef?: React.MutableRefObject<any>
}

const TimelineScene = React.forwardRef<any, TimelineSceneProps>(({
  qualityLevel,
  autoNavigate,
  navigationSpeed,
  onExperienceSelect,
  parentTimelineSceneRef
}, ref) => {
  const { gl, camera, scene } = useThree()
  const sceneManagerRef = useRef<SceneManager | null>(null)
  const timelineSceneRef = useRef<TimelineScene3D | null>(null)
  const orbitControlsRef = useRef<any>(null)
  const [isInitialized, setIsInitialized] = useState(false)


  // Mouse event handlers
  const handlePointerMove = useCallback((event: any) => {
    if (timelineSceneRef.current && camera) {
      timelineSceneRef.current.onMouseMove(event, camera as THREE.PerspectiveCamera)
    }
  }, [camera])

  // Initialize scene manager and timeline scene
  useEffect(() => {
    const initializeScene = async () => {
      try {
        // Create scene manager
        sceneManagerRef.current = SceneManager.getInstance()
        sceneManagerRef.current.initialize(gl, camera as THREE.PerspectiveCamera, qualityLevel)

        // Create timeline scene
        timelineSceneRef.current = new TimelineScene3D({
          id: SectionType.RESUME,
          name: 'Timeline Scene',
          supportedQualityLevels: [QualityLevel.LOW, QualityLevel.MEDIUM, QualityLevel.HIGH, QualityLevel.ULTRA],
          defaultQualityLevel: qualityLevel
        })

        // Register and activate scene
        sceneManagerRef.current.registerScene(timelineSceneRef.current)
        await sceneManagerRef.current.transitionTo(SectionType.RESUME)

        // Pass OrbitControls reference to the scene
        if (orbitControlsRef.current) {
          (timelineSceneRef.current as any).setOrbitControlsRef(orbitControlsRef.current)
        }

        setIsInitialized(true)
      } catch (error) {
        console.error('Failed to initialize timeline scene:', error)
      }
    }

    initializeScene()

    return () => {
      if (sceneManagerRef.current) {
        sceneManagerRef.current.dispose()
      }
    }
  }, [gl, camera, qualityLevel])

  // Expose timeline scene to parent component
  useEffect(() => {
    if (parentTimelineSceneRef && timelineSceneRef.current) {
      parentTimelineSceneRef.current = timelineSceneRef.current
    }
  }, [parentTimelineSceneRef, timelineSceneRef.current])

  // Update auto-navigation settings
  useEffect(() => {
    if (timelineSceneRef.current) {
      // Set the experience selection callback
      if (onExperienceSelect) {
        timelineSceneRef.current.setExperienceSelectCallback(onExperienceSelect)
        timelineSceneRef.current.stopAutoNavigation() // Stop auto-navigation if a callback is set
      }

      if (autoNavigate) {
        timelineSceneRef.current.startAutoNavigation()
        timelineSceneRef.current.setNavigationSpeed(navigationSpeed)
      } else {
        timelineSceneRef.current.stopAutoNavigation()
      }
    }
  }, [autoNavigate, navigationSpeed]) // Remove onExperienceSelect to prevent re-triggering

  // Update quality level
  useEffect(() => {
    if (sceneManagerRef.current) {
      sceneManagerRef.current.setQualityLevel(qualityLevel)
    }
  }, [qualityLevel])

  // Animation loop
  useFrame(() => {
    if (sceneManagerRef.current && isInitialized) {
      sceneManagerRef.current.update()
    }
  })

  // Add global pointer move event listener
  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (timelineSceneRef.current) {
        timelineSceneRef.current.onMouseMove(event, camera as THREE.PerspectiveCamera)
      }
    }

    window.addEventListener('pointermove', handlePointerMove)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
    }
  }, [camera])

  return null
})

TimelineScene.displayName = 'TimelineScene'

/**
 * Timeline Controls Component
 */
interface TimelineControlsProps {
  experiences: TimelineExperience[]
  selectedExperience?: string | null
  onExperienceSelect?: (experience: TimelineExperience) => void
}

const TimelineControls: React.FC<TimelineControlsProps> = ({
  experiences,
  selectedExperience = null,
  onExperienceSelect
}) => {
  const handleExperienceClick = useCallback((experience: TimelineExperience) => {
    // This will trigger the camera animation in the parent component
    onExperienceSelect?.(experience)
  }, [onExperienceSelect])

  return (
    <div className="absolute top-4 left-4 bg-black/20 backdrop-blur-sm rounded-lg p-4 max-w-xs">
      <h3 className="text-white font-semibold mb-3">Timeline Navigation</h3>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {experiences.map((experience) => (
          <button
            key={experience.id}
            onClick={() => handleExperienceClick(experience)}
            className={`w-full text-left p-2 rounded text-sm transition-colors ${
              selectedExperience === experience.id
                ? 'bg-blue-500/50 text-white'
                : 'bg-white/10 text-gray-200 hover:bg-white/20'
            }`}
          >
            <div className="font-medium">{experience.company}</div>
            <div className="text-xs opacity-75">{experience.position}</div>
            <div className="text-xs opacity-60">
              {experience.startDate.getFullYear()} - {experience.endDate?.getFullYear() || 'Present'}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

export default Timeline3D
