'use client'

import React, { ReactNode, useEffect, useState } from 'react'
import { useDeviceCapabilities } from '@/hooks/useDeviceCapabilities'
import { useAdaptiveQuality } from '@/hooks/useAdaptiveQuality'
import { QualityLevel } from '@/types'

interface FallbackSystemProps {
  children: ReactNode
  fallback?: ReactNode
  feature: 'webgl' | 'wasm' | 'shaders' | 'workers' | 'advanced-shaders' | 'high-quality-textures'
  minQuality?: QualityLevel
}

interface FallbackWrapperProps {
  children: ReactNode
  fallback2D?: ReactNode
  loading?: ReactNode
}

export const FeatureFallback: React.FC<FallbackSystemProps> = ({
  children,
  fallback,
  feature,
  minQuality
}) => {
  const { capabilities, isLoading, supportsAdvancedShaders, supportsHighQualityTextures } = useDeviceCapabilities()
  const { getCurrentLevel } = useAdaptiveQuality(false)
  const [shouldUseFallback, setShouldUseFallback] = useState(false)

  useEffect(() => {
    if (isLoading || !capabilities) {
      return
    }

    let featureSupported = false

    switch (feature) {
      case 'webgl':
        featureSupported = capabilities.webglVersion >= 1
        break
      case 'wasm':
        featureSupported = capabilities.supportsWASM
        break
      case 'shaders':
        featureSupported = capabilities.webglVersion >= 2
        break
      case 'workers':
        featureSupported = capabilities.supportsWebWorkers
        break
      case 'advanced-shaders':
        featureSupported = supportsAdvancedShaders()
        break
      case 'high-quality-textures':
        featureSupported = supportsHighQualityTextures()
        break
      default:
        featureSupported = true
    }

    // Check quality level requirement
    if (minQuality) {
      const currentLevel = getCurrentLevel()
      const qualityLevels = [QualityLevel.LOW, QualityLevel.MEDIUM, QualityLevel.HIGH, QualityLevel.ULTRA]
      const currentIndex = qualityLevels.indexOf(currentLevel)
      const minIndex = qualityLevels.indexOf(minQuality)

      if (currentIndex < minIndex) {
        featureSupported = false
      }
    }

    setShouldUseFallback(!featureSupported)
  }, [capabilities, isLoading, feature, minQuality, supportsAdvancedShaders, supportsHighQualityTextures, getCurrentLevel])

  if (isLoading) {
    return <div className="animate-pulse bg-gray-200 rounded h-32" />
  }

  if (shouldUseFallback) {
    return <>{fallback || <SimpleFallback feature={feature} />}</>
  }

  return <>{children}</>
}

const SimpleFallback: React.FC<{ feature: string }> = ({ feature }) => {
  const getMessage = () => {
    switch (feature) {
      case 'webgl':
        return 'WebGL is not supported on this device. Please use a modern browser.'
      case 'wasm':
        return 'WebAssembly is not supported. Using JavaScript fallback.'
      case 'shaders':
        return 'Advanced shaders are not supported. Using simplified rendering.'
      case 'workers':
        return 'Web Workers are not supported. Processing on main thread.'
      case 'advanced-shaders':
        return 'Advanced shader features are not available. Using basic rendering.'
      case 'high-quality-textures':
        return 'High-quality textures are not supported. Using optimized textures.'
      default:
        return 'This feature is not supported on your device.'
    }
  }

  return (
    <div className="flex items-center justify-center p-8 bg-yellow-50 border border-yellow-200 rounded-lg">
      <div className="text-center">
        <div className="text-yellow-600 mb-2">⚠️</div>
        <p className="text-sm text-yellow-800">{getMessage()}</p>
      </div>
    </div>
  )
}

export const FallbackWrapper: React.FC<FallbackWrapperProps> = ({
  children,
  fallback2D,
  loading
}) => {
  const { capabilities, isLoading, error } = useDeviceCapabilities()
  const { getCurrentLevel } = useAdaptiveQuality(false)
  const [use2DFallback, setUse2DFallback] = useState(false)
  const [fallbackReason, setFallbackReason] = useState<string>('')

  useEffect(() => {
    if (isLoading || !capabilities) {
      return
    }

    let shouldUse2D = false
    let reason = ''

    // Check for critical failures
    if (error) {
      shouldUse2D = true
      reason = 'Device capability detection failed'
    }
    // WebGL not supported
    else if (capabilities.webglVersion < 1) {
      shouldUse2D = true
      reason = 'WebGL not supported'
    }
    // Very low memory
    else if (capabilities.memoryGB < 1) {
      shouldUse2D = true
      reason = 'Insufficient memory'
    }
    // Very poor performance on mobile
    else if (capabilities.isMobile && capabilities.performanceScore < 15) {
      shouldUse2D = true
      reason = 'Poor mobile performance'
    }
    // Quality level forced to minimum due to constraints
    else if (getCurrentLevel() === QualityLevel.LOW && capabilities.performanceScore < 25) {
      shouldUse2D = true
      reason = 'Performance constraints'
    }
    // Network constraints on mobile
    else if (capabilities.isMobile && capabilities.network.saveData) {
      shouldUse2D = true
      reason = 'Data saving mode enabled'
    }
    // Battery constraints
    else if (capabilities.battery && !capabilities.battery.charging && capabilities.battery.level < 0.1) {
      shouldUse2D = true
      reason = 'Critical battery level'
    }

    setUse2DFallback(shouldUse2D)
    setFallbackReason(reason)
  }, [capabilities, isLoading, error, getCurrentLevel])

  if (isLoading) {
    return <>{loading || <div className="animate-pulse bg-gray-200 rounded h-64" />}</>
  }

  if (use2DFallback && fallback2D) {
    console.info(`Using 2D fallback: ${fallbackReason}`)
    return <>{fallback2D}</>
  }

  return <>{children}</>
}

// Progressive enhancement wrapper
export const ProgressiveEnhancement: React.FC<{
  children: ReactNode
  lowQuality?: ReactNode
  mediumQuality?: ReactNode
  highQuality?: ReactNode
  ultraQuality?: ReactNode
}> = ({
  children,
  lowQuality,
  mediumQuality,
  highQuality,
  ultraQuality
}) => {
  const { getCurrentLevel } = useAdaptiveQuality(false)
  const currentLevel = getCurrentLevel()

  switch (currentLevel) {
    case QualityLevel.LOW:
      return <>{lowQuality || children}</>
    case QualityLevel.MEDIUM:
      return <>{mediumQuality || children}</>
    case QualityLevel.HIGH:
      return <>{highQuality || children}</>
    case QualityLevel.ULTRA:
      return <>{ultraQuality || children}</>
    default:
      return <>{children}</>
  }
}

// Quality-aware component wrapper
export const QualityAware: React.FC<{
  children: (qualityLevel: QualityLevel, settings: any) => ReactNode
}> = ({ children }) => {
  const { settings, getCurrentLevel } = useAdaptiveQuality(false)

  return <>{children(getCurrentLevel(), settings)}</>
}

// Network-aware loading
export const NetworkAware: React.FC<{
  children: ReactNode
  slowNetworkFallback?: ReactNode
}> = ({ children, slowNetworkFallback }) => {
  const { capabilities } = useDeviceCapabilities()
  const [isSlowNetwork, setIsSlowNetwork] = useState(false)

  useEffect(() => {
    if (capabilities?.network) {
      const { effectiveType, saveData } = capabilities.network
      setIsSlowNetwork(saveData || effectiveType === '2g' || effectiveType === 'slow-2g')
    }
  }, [capabilities])

  if (isSlowNetwork && slowNetworkFallback) {
    return <>{slowNetworkFallback}</>
  }

  return <>{children}</>
}

// Battery-aware component
export const BatteryAware: React.FC<{
  children: ReactNode
  lowBatteryFallback?: ReactNode
  threshold?: number
}> = ({ children, lowBatteryFallback, threshold = 0.2 }) => {
  const { capabilities } = useDeviceCapabilities()
  const [isLowBattery, setIsLowBattery] = useState(false)

  useEffect(() => {
    if (capabilities?.battery) {
      const { level, charging } = capabilities.battery
      setIsLowBattery(!charging && level < threshold)
    }
  }, [capabilities, threshold])

  if (isLowBattery && lowBatteryFallback) {
    return <>{lowBatteryFallback}</>
  }

  return <>{children}</>
}
