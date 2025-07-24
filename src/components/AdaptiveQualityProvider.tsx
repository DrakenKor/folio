'use client'

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { AdaptiveQualitySystem, QualitySettings } from '@/lib/adaptive-quality-system'
import { DeviceDetector, ExtendedDeviceCapabilities } from '@/lib/device-detection'
import { PerformanceMonitor } from '@/lib/performance-monitor'
import { QualityLevel, PerformanceMetrics } from '@/types'
import { AdaptiveQualityErrorBoundary } from './AdaptiveQualityErrorBoundary'

interface AdaptiveQualityContextType {
  // System instances
  qualitySystem: AdaptiveQualitySystem | null
  deviceDetector: DeviceDetector | null
  performanceMonitor: PerformanceMonitor | null

  // State
  isInitialized: boolean
  isInitializing: boolean
  error: string | null

  // Data
  capabilities: ExtendedDeviceCapabilities | null
  settings: QualitySettings | null
  metrics: PerformanceMetrics | null

  // Actions
  initialize: () => Promise<void>
  setQualityLevel: (level: QualityLevel) => void
  resetToAutomatic: () => void
  retry: () => Promise<void>
}

const AdaptiveQualityContext = createContext<AdaptiveQualityContextType | null>(null)

interface AdaptiveQualityProviderProps {
  children: ReactNode
  autoInitialize?: boolean
  onError?: (error: Error) => void
  onInitialized?: (capabilities: ExtendedDeviceCapabilities) => void
}

export const AdaptiveQualityProvider: React.FC<AdaptiveQualityProviderProps> = ({
  children,
  autoInitialize = true,
  onError,
  onInitialized
}) => {
  // System instances
  const [qualitySystem] = useState(() => AdaptiveQualitySystem.getInstance())
  const [deviceDetector] = useState(() => DeviceDetector.getInstance())
  const [performanceMonitor] = useState(() => PerformanceMonitor.getInstance())

  // State
  const [isInitialized, setIsInitialized] = useState(false)
  const [isInitializing, setIsInitializing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Data
  const [capabilities, setCapabilities] = useState<ExtendedDeviceCapabilities | null>(null)
  const [settings, setSettings] = useState<QualitySettings | null>(null)
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null)

  const initialize = async () => {
    if (isInitialized || isInitializing) {
      return
    }

    setIsInitializing(true)
    setError(null)

    try {
      console.log('Initializing adaptive quality system...')

      // Step 1: Detect device capabilities
      const detectedCapabilities = await deviceDetector.detectCapabilities()
      setCapabilities(detectedCapabilities)
      console.log('Device capabilities detected:', detectedCapabilities)

      // Step 2: Initialize quality system
      await qualitySystem.initialize()
      const initialSettings = qualitySystem.getCurrentSettings()
      setSettings(initialSettings)
      console.log('Quality system initialized with settings:', initialSettings)

      // Step 3: Start performance monitoring
      performanceMonitor.startMonitoring()
      console.log('Performance monitoring started')

      // Step 4: Set up callbacks
      const unsubscribeSettings = qualitySystem.onSettingsChange((newSettings) => {
        setSettings(newSettings)
      })

      const unsubscribeMetrics = performanceMonitor.onMetricsUpdate((newMetrics) => {
        setMetrics(newMetrics)
      })

      // Store unsubscribe functions for cleanup
      ;(window as any).__adaptiveQualityCleanup = () => {
        unsubscribeSettings()
        unsubscribeMetrics()
        performanceMonitor.stopMonitoring()
        qualitySystem.dispose()
      }

      setIsInitialized(true)

      if (onInitialized) {
        onInitialized(detectedCapabilities)
      }

      console.log('Adaptive quality system fully initialized')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown initialization error'
      setError(errorMessage)
      console.error('Failed to initialize adaptive quality system:', err)

      if (onError && err instanceof Error) {
        onError(err)
      }
    } finally {
      setIsInitializing(false)
    }
  }

  const retry = async () => {
    setIsInitialized(false)
    await initialize()
  }

  const setQualityLevel = (level: QualityLevel) => {
    if (qualitySystem) {
      qualitySystem.setQualityLevel(level)
    }
  }

  const resetToAutomatic = () => {
    if (qualitySystem) {
      qualitySystem.resetToAutomatic()
    }
  }

  // Auto-initialize on mount
  useEffect(() => {
    if (autoInitialize) {
      initialize()
    }

    // Cleanup on unmount
    return () => {
      if ((window as any).__adaptiveQualityCleanup) {
        ;(window as any).__adaptiveQualityCleanup()
        delete (window as any).__adaptiveQualityCleanup
      }
    }
  }, [autoInitialize])

  const contextValue: AdaptiveQualityContextType = {
    qualitySystem,
    deviceDetector,
    performanceMonitor,
    isInitialized,
    isInitializing,
    error,
    capabilities,
    settings,
    metrics,
    initialize,
    setQualityLevel,
    resetToAutomatic,
    retry
  }

  return (
    <AdaptiveQualityErrorBoundary
      onError={(error, errorInfo) => {
        console.error('Adaptive Quality Provider Error:', error, errorInfo)
        setError(error.message)
        if (onError) {
          onError(error)
        }
      }}
    >
      <AdaptiveQualityContext.Provider value={contextValue}>
        {children}
      </AdaptiveQualityContext.Provider>
    </AdaptiveQualityErrorBoundary>
  )
}

// Hook for using the adaptive quality context
export const useAdaptiveQualityContext = () => {
  const context = useContext(AdaptiveQualityContext)
  if (!context) {
    throw new Error('useAdaptiveQualityContext must be used within an AdaptiveQualityProvider')
  }
  return context
}

// Convenience hooks
export const useQualitySettings = () => {
  const { settings } = useAdaptiveQualityContext()
  return settings
}

export const useDeviceCapabilitiesContext = () => {
  const { capabilities } = useAdaptiveQualityContext()
  return capabilities
}

export const usePerformanceMetricsContext = () => {
  const { metrics } = useAdaptiveQualityContext()
  return metrics
}

// Status component for debugging
export const AdaptiveQualityStatus: React.FC = () => {
  const {
    isInitialized,
    isInitializing,
    error,
    capabilities,
    settings,
    metrics,
    retry
  } = useAdaptiveQualityContext()

  if (isInitializing) {
    return (
      <div className="p-4 bg-blue-50 border border-blue-200 rounded">
        <p className="text-blue-800">Initializing adaptive quality system...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded">
        <p className="text-red-800 mb-2">Error: {error}</p>
        <button
          onClick={retry}
          className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!isInitialized) {
    return (
      <div className="p-4 bg-gray-50 border border-gray-200 rounded">
        <p className="text-gray-800">Adaptive quality system not initialized</p>
      </div>
    )
  }

  return (
    <div className="p-4 bg-green-50 border border-green-200 rounded">
      <h3 className="font-semibold text-green-800 mb-2">Adaptive Quality System Status</h3>
      <div className="space-y-1 text-sm text-green-700">
        <div>Quality Level: <span className="font-medium">{settings?.level}</span></div>
        <div>Performance Score: <span className="font-medium">{capabilities?.performanceScore}/100</span></div>
        <div>Current FPS: <span className="font-medium">{metrics?.fps || 'N/A'}</span></div>
        <div>Memory Usage: <span className="font-medium">{metrics?.memoryUsage || 'N/A'}MB</span></div>
        <div>Device Type: <span className="font-medium">
          {capabilities?.isMobile ? 'Mobile' : capabilities?.isTablet ? 'Tablet' : 'Desktop'}
        </span></div>
      </div>
    </div>
  )
}
