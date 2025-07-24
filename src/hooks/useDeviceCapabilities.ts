import { useEffect, useState } from 'react'
import { DeviceDetector } from '@/lib/device-detection'
import { useAppStore } from '@/stores/app-store'
import { DeviceCapabilities } from '@/types'

export const useDeviceCapabilities = () => {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { deviceCapabilities, setDeviceCapabilities } = useAppStore()

  useEffect(() => {
    const detectCapabilities = async () => {
      try {
        setIsLoading(true)
        setError(null)

        const detector = DeviceDetector.getInstance()
        const capabilities = await detector.detectCapabilities()

        setDeviceCapabilities(capabilities)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to detect device capabilities'
        setError(errorMessage)
        console.error('Device capability detection failed:', err)
      } finally {
        setIsLoading(false)
      }
    }

    if (!deviceCapabilities) {
      detectCapabilities()
    } else {
      setIsLoading(false)
    }
  }, [deviceCapabilities, setDeviceCapabilities])

  return {
    capabilities: deviceCapabilities,
    isLoading,
    error,
    isSupported: (feature: keyof DeviceCapabilities) => {
      return deviceCapabilities ? deviceCapabilities[feature] : false
    }
  }
}
