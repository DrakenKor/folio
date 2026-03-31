'use client'

import React, { useEffect } from 'react'
import { useDeviceCapabilities } from '@/hooks/useDeviceCapabilities'
import { usePerformanceMonitor } from '@/hooks/usePerformanceMonitor'
import { useAppStore } from '@/stores/app-store'
import { ErrorBoundary } from './ErrorBoundary'

interface AppInitializerProps {
  children: React.ReactNode
}

export const AppInitializer: React.FC<AppInitializerProps> = ({ children }) => {
  // Initialize capabilities and monitoring in the background
  useDeviceCapabilities()
  usePerformanceMonitor(true)
  const setInitialized = useAppStore(state => state.setInitialized)

  useEffect(() => {
    // Mark as initialized immediately
    setInitialized()
  }, [setInitialized])

  return (
    <ErrorBoundary>
      {children}
    </ErrorBoundary>
  )
}
