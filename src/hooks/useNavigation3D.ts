import { useState, useEffect, useCallback } from 'react'
import { SectionType } from '@/types'
import { useAppStore, useNavigationState } from '@/stores/app-store'
import { navigationController, NavigationRoute } from '@/lib/navigation-controller'

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
  currentRoute: NavigationRoute
  isTransitioning: boolean
  navigateToSection: (section: SectionType) => void
  navigateNext: () => void
  navigatePrevious: () => void
  navigateToIndex: (index: number) => void
  toggleVisibility: () => void
  showNavigation: () => void
  hideNavigation: () => void
  preloadNext: () => void
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
  const [currentRoute, setCurrentRoute] = useState<NavigationRoute>(navigationController.getCurrentRoute())

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

  // Navigation functions
  const navigateToSection = useCallback(async (section: SectionType) => {
    if (navigationState.isTransitioning || navigationState.currentSection === section) {
      return
    }

    try {
      // Start transition
      startTransition(section)

      // Use navigation controller for proper routing
      navigationController.navigateToSection(section)

      // Announce navigation for accessibility
      navigationController.announceNavigation(section)

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

  const navigateNext = useCallback(() => {
    const nextSection = navigationController.getNextSection()
    navigateToSection(nextSection)
  }, [navigateToSection])

  const navigatePrevious = useCallback(() => {
    const prevSection = navigationController.getPreviousSection()
    navigateToSection(prevSection)
  }, [navigateToSection])

  const navigateToIndex = useCallback((index: number) => {
    const section = navigationController.getSectionByIndex(index)
    if (section) {
      navigateToSection(section)
    }
  }, [navigateToSection])

  const preloadNext = useCallback(() => {
    const nextSection = navigationController.getNextSection()
    navigationController.preloadSection(nextSection)
  }, [])

  const toggleVisibility = useCallback(() => {
    setIsVisible(prev => !prev)
  }, [])

  const showNavigation = useCallback(() => {
    setIsVisible(true)
  }, [])

  const hideNavigation = useCallback(() => {
    setIsVisible(false)
  }, [])

  // Listen to navigation controller changes
  useEffect(() => {
    const unsubscribe = navigationController.addNavigationListener((route) => {
      setCurrentRoute(route)
      setCurrentSection(route.section)
    })

    return unsubscribe
  }, [setCurrentSection])

  // Enhanced keyboard navigation
  useEffect(() => {
    const handleKeyboardNavigation = (event: KeyboardEvent) => {
      if (!isVisible || navigationState.isTransitioning) return

      // Don't interfere with form inputs
      if (event.target instanceof HTMLInputElement ||
          event.target instanceof HTMLTextAreaElement ||
          event.target instanceof HTMLSelectElement) {
        return
      }

      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case 'j':
        case 'J':
          event.preventDefault()
          navigateNext()
          break
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'k':
        case 'K':
          event.preventDefault()
          navigatePrevious()
          break
        case 'Home':
        case 'h':
        case 'H':
          event.preventDefault()
          navigateToSection(SectionType.HOME)
          break
        case 'End':
          event.preventDefault()
          navigateToSection(SectionType.SHADER_PLAYGROUND)
          break
        case 'Escape':
          event.preventDefault()
          if (isMobile) {
            toggleVisibility()
          }
          break
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
          event.preventDefault()
          const index = parseInt(event.key) - 1
          navigateToIndex(index)
          break
        case 'p':
        case 'P':
          event.preventDefault()
          preloadNext()
          break
        case '?':
          // Keyboard help is handled by the Navigation3D component
          // Don't prevent default here to let the component handle it
          break
      }
    }

    const unsubscribe = navigationController.addKeyboardListener(handleKeyboardNavigation)
    return unsubscribe
  }, [isVisible, navigationState.isTransitioning, isMobile, navigateNext, navigatePrevious, navigateToIndex, navigateToSection, preloadNext, toggleVisibility])

  return {
    isVisible,
    isCompact,
    isMobile,
    currentSection: navigationState.currentSection,
    currentRoute,
    isTransitioning: navigationState.isTransitioning,
    navigateToSection,
    navigateNext,
    navigatePrevious,
    navigateToIndex,
    toggleVisibility,
    showNavigation,
    hideNavigation,
    preloadNext
  }
}
