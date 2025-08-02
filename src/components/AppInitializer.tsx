'use client'

import React, { useEffect, useState } from 'react'
import { useDeviceCapabilities } from '@/hooks/useDeviceCapabilities'
import { usePerformanceMonitor } from '@/hooks/usePerformanceMonitor'
import { useAppStore } from '@/stores/app-store'
import { ErrorBoundary } from './ErrorBoundary'
import RubiLoader from '@/app/components/Loaders/RubiLoader'

interface AppInitializerProps {
  children: React.ReactNode
}

export const AppInitializer: React.FC<AppInitializerProps> = ({ children }) => {
  const [initializationComplete, setInitializationComplete] = useState(false)
  const { capabilities, isLoading: capabilitiesLoading, error } = useDeviceCapabilities()
  const { isMonitoring } = usePerformanceMonitor(true)
  const { setInitialized, loadingProgress, setLoadingProgress } = useAppStore()

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Wait for device capabilities
        if (capabilitiesLoading) {
          setLoadingProgress(25)
          return
        }

        if (error) {
          console.warn('Device capabilities detection failed, using defaults')
        }

        setLoadingProgress(50)

        // Initialize performance monitoring
        if (isMonitoring) {
          setLoadingProgress(75)
        }

        // Simulate additional initialization time for smooth UX
        await new Promise(resolve => setTimeout(resolve, 500))

        setLoadingProgress(100)
        setInitialized()
        setInitializationComplete(true)
      } catch (err) {
        console.error('App initialization failed:', err)
        // Continue with initialization even if some features fail
        setInitialized()
        setInitializationComplete(true)
      }
    }

    initializeApp()
  }, [capabilitiesLoading, error, isMonitoring, setInitialized, setLoadingProgress])

  if (!initializationComplete) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <RubiLoader type="white" height={48} width={48} />
        <div className="mt-6 text-center">
          <p className="text-lg text-white mb-2">Initializing Portfolio</p>
          <div className="w-64 bg-gray-700 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${loadingProgress}%` }}
            />
          </div>
          <p className="text-sm text-gray-400 mt-2">
            {loadingProgress < 25 && 'Detecting device capabilities...'}
            {loadingProgress >= 25 && loadingProgress < 50 && 'Configuring performance settings...'}
            {loadingProgress >= 50 && loadingProgress < 75 && 'Starting performance monitoring...'}
            {loadingProgress >= 75 && 'Finalizing initialization...'}
          </p>
        </div>

        {capabilities && (
          <div className="mt-8 text-xs text-gray-500 text-center max-w-md">
            <p>Device: {capabilities.isMobile ? 'Mobile' : capabilities.isTablet ? 'Tablet' : 'Desktop'}</p>
            <p>WebGL: {capabilities.webglVersion === 2 ? 'WebGL 2.0' : 'WebGL 1.0'}</p>
            <p>Features: {capabilities.supportsWASM ? 'WASM ✓' : 'WASM ✗'} | {capabilities.supportsWebWorkers ? 'Workers ✓' : 'Workers ✗'}</p>
          </div>
        )}
      </div>
    )
  }

  return (
    <ErrorBoundary>
      {children}
    </ErrorBoundary>
  )
}
