import { useState, useEffect, useCallback, useRef } from 'react'
import { Vector3 } from 'three'
import { TimelineManager } from '../lib/timeline-manager'
import { TimelineData, TimelineExperience, TimelineCalculationConfig } from '../types/resume'

export interface Timeline3DState {
  timelineData: TimelineData | null
  isLoading: boolean
  error: string | null
  currentExperience: TimelineExperience | null
  isAutoNavigating: boolean
  navigationSpeed: number
  cameraPosition: Vector3 | null
  cameraTarget: Vector3 | null
}

export interface Timeline3DActions {
  navigateToExperience: (experienceId: string) => Promise<void>
  startAutoNavigation: () => void
  stopAutoNavigation: () => void
  setNavigationSpeed: (speed: number) => void
  navigateToTime: (t: number) => Promise<void>
  resetCamera: () => Promise<void>
  updateConfiguration: (config: Partial<TimelineCalculationConfig>) => Promise<void>
  findNearestExperience: (position: Vector3) => Promise<TimelineExperience | null>
  getTimelineStats: () => Promise<{
    totalExperiences: number
    totalYears: number
    averageJobDuration: number
    technologiesUsed: string[]
    companiesWorked: string[]
  }>
}

/**
 * Hook for managing 3D timeline interactions and state
 */
export const useTimeline3D = (): Timeline3DState & Timeline3DActions => {
  const [state, setState] = useState<Timeline3DState>({
    timelineData: null,
    isLoading: true,
    error: null,
    currentExperience: null,
    isAutoNavigating: false,
    navigationSpeed: 0.1,
    cameraPosition: null,
    cameraTarget: null
  })

  const timelineManagerRef = useRef<TimelineManager>()
  const autoNavigationRef = useRef<number | null>(null)

  // Initialize timeline manager
  useEffect(() => {
    timelineManagerRef.current = TimelineManager.getInstance()
  }, [])

  // Load timeline data
  useEffect(() => {
    const loadTimelineData = async () => {
      if (!timelineManagerRef.current) return

      try {
        setState(prev => ({ ...prev, isLoading: true, error: null }))

        const timelineData = await timelineManagerRef.current.initializeTimeline()
        const bounds = await timelineManagerRef.current.getTimelineBounds()
        const optimalDistance = await timelineManagerRef.current.getOptimalViewingDistance()

        // Set initial camera position
        const initialCameraPosition = new Vector3(
          bounds.center.x + optimalDistance * 0.7,
          bounds.center.y,
          bounds.center.z + optimalDistance * 0.7
        )

        setState(prev => ({
          ...prev,
          timelineData,
          isLoading: false,
          cameraPosition: initialCameraPosition,
          cameraTarget: bounds.center
        }))
      } catch (error) {
        console.error('Failed to load timeline data:', error)
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to load timeline data'
        }))
      }
    }

    loadTimelineData()
  }, [])

  // Auto-navigation effect
  useEffect(() => {
    if (state.isAutoNavigating && timelineManagerRef.current && state.timelineData) {
      let currentTime = 0

      const animate = async () => {
        if (!timelineManagerRef.current || !state.isAutoNavigating) return

        try {
          currentTime += state.navigationSpeed * 0.016 // Assuming 60fps
          if (currentTime > 1) currentTime = 0

          const position = await timelineManagerRef.current.getPositionAtTime(currentTime)
          const tangent = await timelineManagerRef.current.getTangentAtTime(currentTime)

          // Calculate camera position
          const cameraDistance = 15
          const cameraOffset = new Vector3()
            .crossVectors(tangent, new Vector3(0, 1, 0))
            .normalize()
            .multiplyScalar(cameraDistance)

          const cameraPosition = position.clone().add(cameraOffset)
          cameraPosition.y += 5

          setState(prev => ({
            ...prev,
            cameraPosition,
            cameraTarget: position
          }))

          autoNavigationRef.current = requestAnimationFrame(animate)
        } catch (error) {
          console.error('Auto-navigation error:', error)
        }
      }

      autoNavigationRef.current = requestAnimationFrame(animate)
    }

    return () => {
      if (autoNavigationRef.current) {
        cancelAnimationFrame(autoNavigationRef.current)
        autoNavigationRef.current = null
      }
    }
  }, [state.isAutoNavigating, state.navigationSpeed])

  // Actions
  const navigateToExperience = useCallback(async (experienceId: string) => {
    if (!timelineManagerRef.current) return

    try {
      const experience = await timelineManagerRef.current.getExperience(experienceId)
      if (!experience) {
        console.warn(`Experience ${experienceId} not found`)
        return
      }

      const cameraPosition = await timelineManagerRef.current.getCameraPositionForExperience(experienceId)
      if (!cameraPosition) return

      setState(prev => ({
        ...prev,
        currentExperience: experience,
        cameraPosition,
        cameraTarget: experience.position3D,
        isAutoNavigating: false
      }))
    } catch (error) {
      console.error('Failed to navigate to experience:', error)
    }
  }, [])

  const startAutoNavigation = useCallback(() => {
    setState(prev => ({ ...prev, isAutoNavigating: true }))
  }, [])

  const stopAutoNavigation = useCallback(() => {
    setState(prev => ({ ...prev, isAutoNavigating: false }))
  }, [])

  const setNavigationSpeed = useCallback((speed: number) => {
    const clampedSpeed = Math.max(0.01, Math.min(1, speed))
    setState(prev => ({ ...prev, navigationSpeed: clampedSpeed }))
  }, [])

  const navigateToTime = useCallback(async (t: number) => {
    if (!timelineManagerRef.current) return

    try {
      const clampedT = Math.max(0, Math.min(1, t))
      const position = await timelineManagerRef.current.getPositionAtTime(clampedT)
      const tangent = await timelineManagerRef.current.getTangentAtTime(clampedT)

      // Calculate camera position
      const cameraDistance = 15
      const cameraOffset = new Vector3()
        .crossVectors(tangent, new Vector3(0, 1, 0))
        .normalize()
        .multiplyScalar(cameraDistance)

      const cameraPosition = position.clone().add(cameraOffset)
      cameraPosition.y += 5

      setState(prev => ({
        ...prev,
        cameraPosition,
        cameraTarget: position,
        isAutoNavigating: false
      }))
    } catch (error) {
      console.error('Failed to navigate to time:', error)
    }
  }, [])

  const resetCamera = useCallback(async () => {
    if (!timelineManagerRef.current) return

    try {
      const bounds = await timelineManagerRef.current.getTimelineBounds()
      const optimalDistance = await timelineManagerRef.current.getOptimalViewingDistance()

      const cameraPosition = new Vector3(
        bounds.center.x + optimalDistance * 0.7,
        bounds.center.y,
        bounds.center.z + optimalDistance * 0.7
      )

      setState(prev => ({
        ...prev,
        cameraPosition,
        cameraTarget: bounds.center,
        currentExperience: null,
        isAutoNavigating: false
      }))
    } catch (error) {
      console.error('Failed to reset camera:', error)
    }
  }, [])

  const updateConfiguration = useCallback(async (config: Partial<TimelineCalculationConfig>) => {
    if (!timelineManagerRef.current) return

    try {
      setState(prev => ({ ...prev, isLoading: true }))

      const timelineData = await timelineManagerRef.current.updateConfiguration(config)
      const bounds = await timelineManagerRef.current.getTimelineBounds()

      setState(prev => ({
        ...prev,
        timelineData,
        isLoading: false,
        cameraTarget: bounds.center
      }))
    } catch (error) {
      console.error('Failed to update configuration:', error)
      setState(prev => ({ ...prev, isLoading: false }))
    }
  }, [])

  const findNearestExperience = useCallback(async (position: Vector3): Promise<TimelineExperience | null> => {
    if (!timelineManagerRef.current) return null

    try {
      return await timelineManagerRef.current.findNearestExperience(position)
    } catch (error) {
      console.error('Failed to find nearest experience:', error)
      return null
    }
  }, [])

  const getTimelineStats = useCallback(async () => {
    if (!timelineManagerRef.current) {
      return {
        totalExperiences: 0,
        totalYears: 0,
        averageJobDuration: 0,
        technologiesUsed: [],
        companiesWorked: []
      }
    }

    try {
      return await timelineManagerRef.current.getTimelineStats()
    } catch (error) {
      console.error('Failed to get timeline stats:', error)
      return {
        totalExperiences: 0,
        totalYears: 0,
        averageJobDuration: 0,
        technologiesUsed: [],
        companiesWorked: []
      }
    }
  }, [])

  return {
    ...state,
    navigateToExperience,
    startAutoNavigation,
    stopAutoNavigation,
    setNavigationSpeed,
    navigateToTime,
    resetCamera,
    updateConfiguration,
    findNearestExperience,
    getTimelineStats
  }
}
