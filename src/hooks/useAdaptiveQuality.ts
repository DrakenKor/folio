import { useEffect, useState, useRef } from 'react'
import { AdaptiveQualitySystem, QualitySettings, AdaptiveQualityConfig } from '@/lib/adaptive-quality-system'
import { QualityLevel } from '@/types'

export interface UseAdaptiveQualityReturn {
  settings: QualitySettings
  isInitialized: boolean
  setQualityLevel: (level: QualityLevel) => void
  setConfig: (config: Partial<AdaptiveQualityConfig>) => void
  overrideSettings: (settings: Partial<QualitySettings>) => void
  resetToAutomatic: () => void
  getCurrentLevel: () => QualityLevel
}

export const useAdaptiveQuality = (autoInitialize = true): UseAdaptiveQualityReturn => {
  const [settings, setSettings] = useState<QualitySettings>(() =>
    AdaptiveQualitySystem.getInstance().getCurrentSettings()
  )
  const [isInitialized, setIsInitialized] = useState(false)
  const systemRef = useRef<AdaptiveQualitySystem | null>(null)
  const unsubscribeRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    // Get the singleton instance
    systemRef.current = AdaptiveQualitySystem.getInstance()

    // Subscribe to settings changes
    unsubscribeRef.current = systemRef.current.onSettingsChange((newSettings) => {
      setSettings(newSettings)
    })

    // Initialize if auto-initialize is enabled
    if (autoInitialize) {
      systemRef.current.initialize().then(() => {
        setIsInitialized(true)
      }).catch((error) => {
        console.error('Failed to initialize adaptive quality system:', error)
        setIsInitialized(true) // Still mark as initialized to prevent hanging
      })
    } else {
      setIsInitialized(true)
    }

    // Cleanup on unmount
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
      }
    }
  }, [autoInitialize])

  const setQualityLevel = (level: QualityLevel) => {
    systemRef.current?.setQualityLevel(level)
  }

  const setConfig = (config: Partial<AdaptiveQualityConfig>) => {
    systemRef.current?.setConfig(config)
  }

  const overrideSettings = (settingsOverride: Partial<QualitySettings>) => {
    systemRef.current?.overrideSettings(settingsOverride)
  }

  const resetToAutomatic = () => {
    systemRef.current?.resetToAutomatic()
  }

  const getCurrentLevel = (): QualityLevel => {
    return settings.level
  }

  return {
    settings,
    isInitialized,
    setQualityLevel,
    setConfig,
    overrideSettings,
    resetToAutomatic,
    getCurrentLevel
  }
}

// Hook for getting just the current quality level
export const useQualityLevel = (): QualityLevel => {
  const { settings } = useAdaptiveQuality(false)
  return settings.level
}

// Hook for checking specific quality features
export const useQualityFeatures = () => {
  const { settings } = useAdaptiveQuality(false)

  return {
    shouldRenderShadows: settings.shadowQuality !== 'none',
    shouldUsePostProcessing: settings.postProcessing,
    shouldUseAntialiasing: settings.antialiasing,
    particleCount: settings.particleCount,
    renderScale: settings.renderScale,
    maxLights: settings.maxLights,
    textureQuality: settings.textureQuality,
    enableReflections: settings.enableReflections,
    enableSSAO: settings.enableSSAO,
    enableBloom: settings.enableBloom
  }
}
