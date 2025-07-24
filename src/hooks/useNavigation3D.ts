import { useState, useEffect, useCallback } from 'react'
import { SectionType } from '@/types'
import { useAppStore, useNavigationState } from '@/stores/app-store'

interface UseNavigation3DOptions {
  autoHide?: boolean
  hideDelay?: number
  showOnHover?: boolean
}

interface UseNavigation3DReturn {
  isVisible: boolean
  isCompact: boolean
  isMobile: boolean
  currentSection: SectionType
  isTransitioning: boolean
  navigateToSection: (section: SectionType) => void
  toggleVisibility: () => void
  showNavigation: () => void
  hideNavigation: () => void
}

export const useNavigation3D = (options: UseNavigation3DOptions = {}): UseNavigation3DReturn => {
  const {
    autoHide = false,
    hideDelay = 3000,
    showOnHover = true
  } = options

  const [isVisible, setIsVisible] = useState(true)
  const [isCompact, setIsCompact] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [hideTimer, setHideTimer] = useState<NodeJS.Timeout | null>(null)

  const navigationState = useNavigationState()
  const { setCurrentSection, startTransition, completeTransition } = useAppStore()

  // Detect screen size and device type
  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth
      const height = window.innerHeight

      setIsMobile(width < 768)
      setIsCompact(width < 1024 || height < 600)
    }

    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)

    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])

  // Auto-hide functionality
  useEffect(() => {
    if (!autoHide) return

    const resetTimer = () => {
      if (hideTimer) {
        clearTimeout(hideTimer)
      }

      const timer = setTimeout(() => {
        setIsVisible(false)
      }, hideDelay)

      setHideTimer(timer)
    }

    // Show navigation on mouse movement
    const handleMouseMove = () => {
      if (!isVisible) {
        setIsVisible(true)
      }
      resetTimer()
    }

    // Show navigation on touch
    const handleTouch = () => {
      if (!isVisible) {
        setIsVisible(true)
      }
      resetTimer()
    }

    if (showOnHover) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('touchstart', handleTouch)
    }

    resetTimer()

    return () => {
      if (hideTimer) {
        clearTimeout(hideTimer)
      }
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('touchstart', handleTouch)
    }
  }, [autoHide, hideDelay, showOnHover, isVisible, hideTimer])

  const navigateToSection = useCallback(async (section: SectionType) => {
    if (navigationState.isTransitioning || navigationState.currentSection === section) {
      return
    }

    try {
      // Start transition
      startTransition(section)

      // Simulate transition delay (this would be replaced with actual scene transition)
      await new Promise(resolve => setTimeout(resolve, 800))

      // Complete transition
      completeTransition()
    } catch (error) {
      console.error('Navigation transition failed:', error)
      // Fallback: just set the section directly
      setCurrentSection(section)
    }
  }, [navigationState.isTransitioning, navigationState.currentSection, startTransition, completeTransition, setCurrentSection])

  const toggleVisibility = useCallback(() => {
    setIsVisible(prev => !prev)
  }, [])

  const showNavigation = useCallback(() => {
    setIsVisible(true)
  }, [])

  const hideNavigation = useCallback(() => {
    setIsVisible(false)
  }, [])

  return {
    isVisible,
    isCompact,
    isMobile,
    currentSection: navigationState.currentSection,
    isTransitioning: navigationState.isTransitioning,
    navigateToSection,
    toggleVisibility,
    showNavigation,
    hideNavigation
  }
}
