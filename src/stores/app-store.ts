import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import {
  AppConfig,
  DeviceCapabilities,
  PerformanceMetrics,
  QualityLevel,
  SectionType,
  NavigationState,
  FeatureFlags,
  PerformanceConfig
} from '@/types'

interface AppState {
  // Configuration
  config: AppConfig
  deviceCapabilities: DeviceCapabilities | null
  performanceMetrics: PerformanceMetrics | null

  // Navigation
  navigation: NavigationState

  // Loading states
  isInitializing: boolean
  isTransitioning: boolean
  loadingProgress: number

  // Actions
  setDeviceCapabilities: (capabilities: DeviceCapabilities) => void
  setPerformanceMetrics: (metrics: PerformanceMetrics) => void
  setQualityLevel: (level: QualityLevel) => void
  setCurrentSection: (section: SectionType) => void
  startTransition: (to: SectionType) => void
  completeTransition: () => void
  setLoadingProgress: (progress: number) => void
  setInitialized: () => void
  updateFeatureFlags: (flags: Partial<FeatureFlags>) => void
  updatePerformanceConfig: (config: Partial<PerformanceConfig>) => void
}

const defaultConfig: AppConfig = {
  performance: {
    targetFPS: 60,
    maxParticles: 160,
    enableShadows: true,
    enablePostProcessing: true,
    adaptiveQuality: true
  },
  features: {
    enable3D: true,
    enableWASM: true,
    enableShaders: true,
    enableAudio: false,
    enableParticles: true
  },
  quality: QualityLevel.HIGH
}

const defaultNavigation: NavigationState = {
  currentSection: SectionType.HOME,
  previousSection: null,
  isTransitioning: false,
  transitionProgress: 0
}

export const useAppStore = create<AppState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    config: defaultConfig,
    deviceCapabilities: null,
    performanceMetrics: null,
    navigation: defaultNavigation,
    isInitializing: true,
    isTransitioning: false,
    loadingProgress: 0,

    // Actions
    setDeviceCapabilities: (capabilities) => {
      set({ deviceCapabilities: capabilities })

      // Auto-adjust config based on capabilities
      const state = get()
      const newConfig = { ...state.config }

      if (capabilities.isMobile) {
        newConfig.performance.maxParticles = Math.min(80, newConfig.performance.maxParticles)
        newConfig.performance.enableShadows = false
        newConfig.performance.enablePostProcessing = false
      }

      if (!capabilities.supportsWASM) {
        newConfig.features.enableWASM = false
      }

      if (capabilities.webglVersion < 2) {
        newConfig.features.enableShaders = false
        newConfig.performance.enablePostProcessing = false
      }

      set({ config: newConfig })
    },

    setPerformanceMetrics: (metrics) => {
      set({ performanceMetrics: metrics })

      // Auto-adjust quality based on performance
      const state = get()
      if (state.config.performance.adaptiveQuality) {
        if (metrics.fps < 20 && state.config.quality !== QualityLevel.LOW) {
          get().setQualityLevel(QualityLevel.LOW)
        } else if (metrics.fps < 30 && state.config.quality === QualityLevel.ULTRA) {
          get().setQualityLevel(QualityLevel.HIGH)
        } else if (metrics.fps > 50 && state.config.quality === QualityLevel.LOW) {
          get().setQualityLevel(QualityLevel.MEDIUM)
        }
      }
    },

    setQualityLevel: (level) => {
      set((state) => ({
        config: {
          ...state.config,
          quality: level,
          performance: {
            ...state.config.performance,
            maxParticles: level === QualityLevel.LOW ? 40 :
                         level === QualityLevel.MEDIUM ? 80 :
                         level === QualityLevel.HIGH ? 160 : 240,
            enableShadows: level !== QualityLevel.LOW,
            enablePostProcessing: level === QualityLevel.HIGH || level === QualityLevel.ULTRA
          }
        }
      }))
    },

    setCurrentSection: (section) => {
      set((state) => ({
        navigation: {
          ...state.navigation,
          previousSection: state.navigation.currentSection,
          currentSection: section
        }
      }))
    },

    startTransition: (to) => {
      set((state) => ({
        navigation: {
          ...state.navigation,
          previousSection: state.navigation.currentSection,
          currentSection: to,
          isTransitioning: true,
          transitionProgress: 0
        },
        isTransitioning: true
      }))
    },

    completeTransition: () => {
      set((state) => ({
        navigation: {
          ...state.navigation,
          isTransitioning: false,
          transitionProgress: 1
        },
        isTransitioning: false
      }))
    },

    setLoadingProgress: (progress) => {
      set({ loadingProgress: progress })
    },

    setInitialized: () => {
      set({ isInitializing: false })
    },

    updateFeatureFlags: (flags) => {
      set((state) => ({
        config: {
          ...state.config,
          features: {
            ...state.config.features,
            ...flags
          }
        }
      }))
    },

    updatePerformanceConfig: (config) => {
      set((state) => ({
        config: {
          ...state.config,
          performance: {
            ...state.config.performance,
            ...config
          }
        }
      }))
    }
  }))
)

// Selectors for common use cases
export const useDeviceCapabilities = () => useAppStore(state => state.deviceCapabilities)
export const usePerformanceMetrics = () => useAppStore(state => state.performanceMetrics)
export const useQualityLevel = () => useAppStore(state => state.config.quality)
export const useCurrentSection = () => useAppStore(state => state.navigation.currentSection)
export const useIsTransitioning = () => useAppStore(state => state.navigation.isTransitioning)
export const useFeatureFlags = () => useAppStore(state => state.config.features)
export const usePerformanceConfig = () => useAppStore(state => state.config.performance)
