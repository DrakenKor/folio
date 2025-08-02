import { PerformanceMetrics, QualityLevel } from '@/types'
import { RenderStats } from '@/types/three'

export class PerformanceMonitor {
  private static instance: PerformanceMonitor
  private metrics: PerformanceMetrics
  private frameCount = 0
  private lastTime = 0
  private fpsHistory: number[] = []
  private memoryHistory: number[] = []
  private isMonitoring = false
  private callbacks: ((metrics: PerformanceMetrics) => void)[] = []

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor()
    }
    return PerformanceMonitor.instance
  }

  constructor() {
    this.metrics = {
      fps: 60,
      memoryUsage: 0,
      renderTime: 0,
      frameTime: 0,
      drawCalls: 0,
      triangles: 0
    }
  }

  startMonitoring(): void {
    if (this.isMonitoring) return

    this.isMonitoring = true
    this.lastTime = performance.now()
    this.monitorLoop()
  }

  stopMonitoring(): void {
    this.isMonitoring = false
  }

  private monitorLoop(): void {
    if (!this.isMonitoring) return

    const currentTime = performance.now()
    const deltaTime = currentTime - this.lastTime

    // Update frame metrics
    this.frameCount++
    this.metrics.frameTime = deltaTime

    // Calculate FPS every second
    if (deltaTime >= 1000) {
      const fps = Math.round((this.frameCount * 1000) / deltaTime)
      this.updateFPS(fps)
      this.frameCount = 0
      this.lastTime = currentTime
    }

    // Update memory usage
    this.updateMemoryUsage()

    // Notify callbacks
    this.notifyCallbacks()

    requestAnimationFrame(() => this.monitorLoop())
  }

  private updateFPS(fps: number): void {
    this.fpsHistory.push(fps)
    if (this.fpsHistory.length > 60) {
      this.fpsHistory.shift()
    }

    // Calculate average FPS
    const avgFPS = this.fpsHistory.reduce((sum, f) => sum + f, 0) / this.fpsHistory.length
    this.metrics.fps = Math.round(avgFPS)
  }

  private updateMemoryUsage(): void {
    if ('memory' in performance) {
      const memory = (performance as any).memory
      const usedMB = Math.round(memory.usedJSHeapSize / (1024 * 1024))

      this.memoryHistory.push(usedMB)
      if (this.memoryHistory.length > 60) {
        this.memoryHistory.shift()
      }

      const avgMemory = this.memoryHistory.reduce((sum, m) => sum + m, 0) / this.memoryHistory.length
      this.metrics.memoryUsage = Math.round(avgMemory)
    }
  }

  updateRenderStats(stats: Partial<RenderStats>): void {
    if (stats.renderTime !== undefined) {
      this.metrics.renderTime = stats.renderTime
    }
    if (stats.drawCalls !== undefined) {
      this.metrics.drawCalls = stats.drawCalls
    }
    if (stats.triangles !== undefined) {
      this.metrics.triangles = stats.triangles
    }
  }

  getMetrics(): PerformanceMetrics {
    return { ...this.metrics }
  }

  getAverageFPS(): number {
    if (this.fpsHistory.length === 0) return 60
    return this.fpsHistory.reduce((sum, fps) => sum + fps, 0) / this.fpsHistory.length
  }

  isPerformanceGood(): boolean {
    return this.getAverageFPS() >= 30 && this.metrics.memoryUsage < 500
  }

  shouldReduceQuality(): boolean {
    return this.getAverageFPS() < 20 || this.metrics.memoryUsage > 800
  }

  getRecommendedQuality(): QualityLevel {
    const avgFPS = this.getAverageFPS()
    const memoryUsage = this.metrics.memoryUsage

    if (avgFPS >= 55 && memoryUsage < 200) {
      return QualityLevel.ULTRA
    }
    if (avgFPS >= 45 && memoryUsage < 400) {
      return QualityLevel.HIGH
    }
    if (avgFPS >= 30 && memoryUsage < 600) {
      return QualityLevel.MEDIUM
    }
    return QualityLevel.LOW
  }

  onMetricsUpdate(callback: (metrics: PerformanceMetrics) => void): () => void {
    this.callbacks.push(callback)

    // Return unsubscribe function
    return () => {
      const index = this.callbacks.indexOf(callback)
      if (index > -1) {
        this.callbacks.splice(index, 1)
      }
    }
  }

  private notifyCallbacks(): void {
    this.callbacks.forEach(callback => {
      try {
        callback(this.metrics)
      } catch (error) {
        console.error('Error in performance metrics callback:', error)
      }
    })
  }

  reset(): void {
    this.frameCount = 0
    this.fpsHistory = []
    this.memoryHistory = []
    this.metrics = {
      fps: 60,
      memoryUsage: 0,
      renderTime: 0,
      frameTime: 0,
      drawCalls: 0,
      triangles: 0
    }
  }
}
