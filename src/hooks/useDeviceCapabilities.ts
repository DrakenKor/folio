import { useEffect, useState } from 'react'
import { DeviceDetector } from '@/lib/device-detection'
import { useAppStore } from '@/stores/app-store'
import { ExtendedDeviceCapabilities } from '@/types'

export const useDeviceCapabilities = () => {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const deviceCapabilities = useAppStore(state => state.deviceCapabilities)
  const setDeviceCapabilities = useAppStore(state => state.setDeviceCapabilities)

  useEffect(() => {
    let mounted = true
    const timeoutId = setTimeout(() => {
      if (mounted) {
        console.warn('Device detection timeout')
        setIsLoading(false)
      }
    }, 2000)

    const detectCapabilities = async () => {
      try {
        setIsLoading(true)
        setError(null)

        const detector = DeviceDetector.getInstance()
        const capabilities = await detector.detectCapabilities()

        if (mounted) {
          clearTimeout(timeoutId)
          setDeviceCapabilities(capabilities)
          setIsLoading(false)
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to detect device capabilities'
        if (mounted) {
          clearTimeout(timeoutId)
          setError(errorMessage)
          console.error('Device capability detection failed:', err)
          setIsLoading(false)
        }
      }
    }

    if (!deviceCapabilities) {
      detectCapabilities()
    } else {
      clearTimeout(timeoutId)
      setIsLoading(false)
    }

    return () => {
      mounted = false
      clearTimeout(timeoutId)
    }
  }, [deviceCapabilities, setDeviceCapabilities])

  return {
    capabilities: deviceCapabilities,
    isLoading,
    error,
    isSupported: (feature: keyof ExtendedDeviceCapabilities) => {
      return deviceCapabilities ? deviceCapabilities[feature] : false
    },
    // Helper methods for common checks
    supportsAdvancedShaders: () => {
      const detector = DeviceDetector.getInstance()
      return detector.supportsAdvancedShaders()
    },
    supportsHighQualityTextures: () => {
      const detector = DeviceDetector.getInstance()
      return detector.supportsHighQualityTextures()
    },
    shouldUseLowPowerMode: () => {
      const detector = DeviceDetector.getInstance()
      return detector.shouldUseLowPowerMode()
    }
  }
}
