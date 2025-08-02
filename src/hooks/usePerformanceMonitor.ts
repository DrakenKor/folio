import { useEffect, useRef } from 'react'
import { PerformanceMonitor } from '@/lib/performance-monitor'
import { useAppStore } from '@/stores/app-store'

export const usePerformanceMonitor = (enabled = true) => {
  const { performanceMetrics, setPerformanceMetrics } = useAppStore()
  const monitorRef = useRef<PerformanceMonitor | null>(null)
  const unsubscribeRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!enabled) return

    // Get monitor instance
    monitorRef.current = PerformanceMonitor.getInstance()

    // Subscribe to metrics updates
    unsubscribeRef.current = monitorRef.current.onMetricsUpdate((metrics) => {
      setPerformanceMetrics(metrics)
    })

    // Start monitoring
    monitorRef.current.startMonitoring()

    return () => {
      // Cleanup
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
      }
      if (monitorRef.current) {
        monitorRef.current.stopMonitoring()
      }
    }
  }, [enabled, setPerformanceMetrics])

  return {
    metrics: performanceMetrics,
    monitor: monitorRef.current,
    isMonitoring: enabled && monitorRef.current !== null
  }
}
