import { QualityLevel, PerformanceMetrics, ExtendedDeviceCapabilities } from '@/types'
import { DeviceDetector } from './device-detection'
import { PerformanceMonitor } from './performance-monitor'

export interface QualitySettings {
  level: QualityLevel
  particleCount: number
  shadowQuality: 'none' | 'low' | 'medium' | 'high'
  textureQuality: 'low' | 'medium' | 'high' | 'ultra'
  postProcessing: boolean
  antialiasing: boolean
  anisotropicFiltering: number
  renderScale: number
  maxLights: number
  enableReflections: boolean
  enableSSAO: boolean
  enableBloom: boolean
  lodBias: number
}

export interface AdaptiveQualityConfig {
  targetFPS: number
  minFPS: number
  maxFPS: number
  adjustmentInterval: number
  aggressiveMode: boolean
  batteryAware: boolean
  networkAware: boolean
}

export class AdaptiveQualitySystem {
  private static instance: AdaptiveQualitySystem
  private deviceDetector: DeviceDetector
  private performanceMonitor: PerformanceMonitor
  private currentSettings: QualitySettings
  private config: AdaptiveQualityConfig
  private adjustmentTimer: number | null = null
  private performanceHistory: number[] = []
  private lastAdjustment = 0
  private callbacks: ((settings: QualitySettings) => void)[] = []

  static getInstance(): AdaptiveQualitySystem {
    if (!AdaptiveQualitySystem.instance) {
      AdaptiveQualitySystem.instance = new AdaptiveQualitySystem()
    }
    return AdaptiveQualitySystem.instance
  }

  constructor() {
    this.deviceDetector = DeviceDetector.getInstance()
    this.performanceMonitor = PerformanceMonitor.getInstance()

    this.config = {
      targetFPS: 60,
      minFPS: 30,
      maxFPS: 120,
      adjustmentInterval: 2000, // 2 seconds
      aggressiveMode: false,
      batteryAware: true,
      networkAware: true
    }

    this.currentSettings = this.getDefaultSettings()
  }

  async initialize(): Promise<void> {
    try {
      const capabilities = await this.deviceDetector.detectCapabilities()
      this.currentSettings = this.calculateOptimalSettings(capabilities)
      this.startAdaptiveAdjustment()
    } catch (error) {
      console.error('Failed to initialize adaptive quality system:', error)
      // Use fallback settings
      this.currentSettings = this.getFallbackSettings()
    }
  }

  private calculateOptimalSettings(capabilities: ExtendedDeviceCapabilities): QualitySettings {
    const { performanceScore, isMobile, gpu, network, battery } = capabilities

    let baseLevel: QualityLevel

    // Determine base quality level
    if (performanceScore >= 80) {
      baseLevel = isMobile ? QualityLevel.HIGH : QualityLevel.ULTRA
    } else if (performanceScore >= 60) {
      baseLevel = QualityLevel.HIGH
    } else if (performanceScore >= 40) {
      baseLevel = QualityLevel.MEDIUM
    } else {
      baseLevel = QualityLevel.LOW
    }

    // Apply constraints based on specific conditions
    if (battery && this.config.batteryAware) {
      if (!battery.charging && battery.level < 0.2) {
        baseLevel = QualityLevel.LOW
      } else if (!battery.charging && battery.level < 0.5 && baseLevel === QualityLevel.ULTRA) {
        baseLevel = QualityLevel.HIGH
      }
    }

    if (network && this.config.networkAware) {
      if (network.saveData || network.effectiveType === '2g') {
        baseLevel = QualityLevel.LOW
      } else if (network.effectiveType === '3g' && baseLevel === QualityLevel.ULTRA) {
        baseLevel = QualityLevel.HIGH
      }
    }

    return this.getSettingsForLevel(baseLevel, capabilities)
  }

  private getSettingsForLevel(level: QualityLevel, capabilities?: ExtendedDeviceCapabilities): QualitySettings {
    const isMobile = capabilities?.isMobile || false
    const supportsFloatTextures = capabilities?.gpu.supportsFloatTextures || false
    const maxTextureSize = capabilities?.maxTextureSize || 1024

    switch (level) {
      case QualityLevel.ULTRA:
        return {
          level,
          particleCount: isMobile ? 200 : 400,
          shadowQuality: 'high',
          textureQuality: maxTextureSize >= 4096 ? 'ultra' : 'high',
          postProcessing: true,
          antialiasing: true,
          anisotropicFiltering: 16,
          renderScale: 1.0,
          maxLights: 8,
          enableReflections: supportsFloatTextures,
          enableSSAO: supportsFloatTextures,
          enableBloom: true,
          lodBias: 0
        }

      case QualityLevel.HIGH:
        return {
          level,
          particleCount: isMobile ? 150 : 250,
          shadowQuality: 'medium',
          textureQuality: 'high',
          postProcessing: true,
          antialiasing: true,
          anisotropicFiltering: 8,
          renderScale: 1.0,
          maxLights: 6,
          enableReflections: false,
          enableSSAO: supportsFloatTextures,
          enableBloom: true,
          lodBias: 0
        }

      case QualityLevel.MEDIUM:
        return {
          level,
          particleCount: isMobile ? 80 : 150,
          shadowQuality: 'low',
          textureQuality: 'medium',
          postProcessing: false,
          antialiasing: !isMobile,
          anisotropicFiltering: 4,
          renderScale: isMobile ? 0.8 : 1.0,
          maxLights: 4,
          enableReflections: false,
          enableSSAO: false,
          enableBloom: false,
          lodBias: 1
        }

      case QualityLevel.LOW:
      default:
        return {
          level,
          particleCount: isMobile ? 40 : 80,
          shadowQuality: 'none',
          textureQuality: 'low',
          postProcessing: false,
          antialiasing: false,
          anisotropicFiltering: 1,
          renderScale: isMobile ? 0.6 : 0.8,
          maxLights: 2,
          enableReflections: false,
          enableSSAO: false,
          enableBloom: false,
          lodBias: 2
        }
    }
  }

  private getDefaultSettings(): QualitySettings {
    return this.getSettingsForLevel(QualityLevel.MEDIUM)
  }

  private getFallbackSettings(): QualitySettings {
    return this.getSettingsForLevel(QualityLevel.LOW)
  }

  private startAdaptiveAdjustment(): void {
    if (this.adjustmentTimer) {
      clearInterval(this.adjustmentTimer)
    }

    this.adjustmentTimer = window.setInterval(() => {
      this.adjustQualityBasedOnPerformance()
    }, this.config.adjustmentInterval)
  }

  private adjustQualityBasedOnPerformance(): void {
    try {
      const metrics = this.performanceMonitor.getMetrics()
      const now = Date.now()

      // Don't adjust too frequently
      if (now - this.lastAdjustment < this.config.adjustmentInterval) {
        return
      }

      // Validate metrics
      if (!metrics || typeof metrics.fps !== 'number' || isNaN(metrics.fps)) {
        console.warn('Invalid performance metrics, skipping adjustment')
        return
      }

      // Add current FPS to history
      this.performanceHistory.push(metrics.fps)
      if (this.performanceHistory.length > 10) {
        this.performanceHistory.shift()
      }

      // Calculate average FPS over recent history
      const avgFPS = this.performanceHistory.reduce((sum, fps) => sum + fps, 0) / this.performanceHistory.length

      // Enhanced performance analysis
      const capabilities = this.deviceDetector.getCapabilities()
      const isLowEndDevice = capabilities && (
        capabilities.isMobile && capabilities.performanceScore < 40 ||
        capabilities.memoryGB < 2 ||
        capabilities.webglVersion < 2
      )

      // Adjust thresholds based on device capabilities
      const minFPSThreshold = isLowEndDevice ? 20 : this.config.minFPS
      const maxFPSThreshold = isLowEndDevice ? 40 : this.config.maxFPS

      // More sophisticated adjustment logic
      const shouldDecrease = (
        avgFPS < minFPSThreshold && this.performanceHistory.length >= 3
      ) || (
        // Aggressive mode for low-end devices
        isLowEndDevice && avgFPS < 25 && this.performanceHistory.length >= 2
      )

      const shouldIncrease = (
        avgFPS > (maxFPSThreshold * 0.9) &&
        this.currentSettings.level !== QualityLevel.ULTRA &&
        this.performanceHistory.length >= 5 &&
        !isLowEndDevice // Don't increase on low-end devices
      )

      if (shouldDecrease) {
        this.decreaseQuality()
        this.lastAdjustment = now
        console.log(`Quality decreased due to low FPS: ${avgFPS.toFixed(1)}`)
      } else if (shouldIncrease) {
        // Only increase if performance has been consistently good
        const recentPerformance = this.performanceHistory.slice(-3)
        const allGood = recentPerformance.every(fps => fps > maxFPSThreshold * 0.8)

        if (allGood) {
          this.increaseQuality()
          this.lastAdjustment = now
          console.log(`Quality increased due to good FPS: ${avgFPS.toFixed(1)}`)
        }
      }

      // Enhanced memory pressure detection
      if (typeof metrics.memoryUsage === 'number') {
        const memoryThreshold = capabilities?.memoryGB && capabilities.memoryGB < 4 ? 400 : 800
        if (metrics.memoryUsage > memoryThreshold) {
          this.applyMemoryPressureAdjustments()
          this.lastAdjustment = now
        }
      }

      // Check for thermal throttling indicators
      this.checkThermalThrottling(metrics)

      // Check battery status if available
      this.checkBatteryStatus()

      // Check for network degradation
      this.checkNetworkConditions()
    } catch (error) {
      console.error('Error during quality adjustment:', error)
    }
  }

  private decreaseQuality(): void {
    const currentLevel = this.currentSettings.level
    let newLevel: QualityLevel

    switch (currentLevel) {
      case QualityLevel.ULTRA:
        newLevel = QualityLevel.HIGH
        break
      case QualityLevel.HIGH:
        newLevel = QualityLevel.MEDIUM
        break
      case QualityLevel.MEDIUM:
        newLevel = QualityLevel.LOW
        break
      case QualityLevel.LOW:
      default:
        // Already at lowest, apply micro-adjustments
        this.applyMicroAdjustments(false)
        return
    }

    console.log(`Adaptive Quality: Decreasing from ${currentLevel} to ${newLevel}`)
    this.setQualityLevel(newLevel)
  }

  private increaseQuality(): void {
    const currentLevel = this.currentSettings.level
    let newLevel: QualityLevel

    switch (currentLevel) {
      case QualityLevel.LOW:
        newLevel = QualityLevel.MEDIUM
        break
      case QualityLevel.MEDIUM:
        newLevel = QualityLevel.HIGH
        break
      case QualityLevel.HIGH:
        newLevel = QualityLevel.ULTRA
        break
      case QualityLevel.ULTRA:
      default:
        // Already at highest, apply micro-adjustments
        this.applyMicroAdjustments(true)
        return
    }

    console.log(`Adaptive Quality: Increasing from ${currentLevel} to ${newLevel}`)
    this.setQualityLevel(newLevel)
  }

  private applyMicroAdjustments(increase: boolean): void {
    const factor = increase ? 1.1 : 0.9

    // Adjust particle count
    this.currentSettings.particleCount = Math.round(
      Math.max(20, Math.min(500, this.currentSettings.particleCount * factor))
    )

    // Adjust render scale
    this.currentSettings.renderScale = Math.max(
      0.5, Math.min(1.0, this.currentSettings.renderScale * factor)
    )

    this.notifyCallbacks()
  }

  private applyMemoryPressureAdjustments(): void {
    // Reduce particle count
    this.currentSettings.particleCount = Math.max(20, Math.round(this.currentSettings.particleCount * 0.8))

    // Disable expensive effects
    if (this.currentSettings.enableReflections) {
      this.currentSettings.enableReflections = false
    }
    if (this.currentSettings.enableSSAO) {
      this.currentSettings.enableSSAO = false
    }

    // Reduce texture quality
    if (this.currentSettings.textureQuality === 'ultra') {
      this.currentSettings.textureQuality = 'high'
    } else if (this.currentSettings.textureQuality === 'high') {
      this.currentSettings.textureQuality = 'medium'
    }

    console.log('Adaptive Quality: Applied memory pressure adjustments')
    this.notifyCallbacks()
  }

  private async checkBatteryStatus(): Promise<void> {
    if (!this.config.batteryAware) return

    try {
      const capabilities = this.deviceDetector.getCapabilities()
      if (capabilities?.battery) {
        const { battery } = capabilities

        if (!battery.charging && battery.level < 0.15) {
          // Critical battery - force low quality
          this.setQualityLevel(QualityLevel.LOW)
          console.log('Quality reduced to LOW due to critical battery level')
        } else if (!battery.charging && battery.level < 0.3 && this.currentSettings.level === QualityLevel.ULTRA) {
          // Low battery - reduce from ultra
          this.setQualityLevel(QualityLevel.HIGH)
          console.log('Quality reduced from ULTRA due to low battery')
        }
      }
    } catch (error) {
      // Battery API not available, ignore
    }
  }

  private checkThermalThrottling(metrics: PerformanceMetrics): void {
    // Detect potential thermal throttling by monitoring frame time consistency
    if (this.performanceHistory.length >= 5) {
      const recentFrames = this.performanceHistory.slice(-5)
      const variance = this.calculateVariance(recentFrames)

      // High variance in frame times might indicate thermal throttling
      if (variance > 100 && metrics.fps < 40) {
        console.log('Potential thermal throttling detected, reducing quality')
        this.applyThermalThrottlingAdjustments()
      }
    }
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2))
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length
  }

  private applyThermalThrottlingAdjustments(): void {
    // More aggressive quality reduction for thermal issues
    if (this.currentSettings.level === QualityLevel.ULTRA) {
      this.setQualityLevel(QualityLevel.MEDIUM)
    } else if (this.currentSettings.level === QualityLevel.HIGH) {
      this.setQualityLevel(QualityLevel.LOW)
    } else {
      // Already at low, apply micro-adjustments
      this.currentSettings.particleCount = Math.max(20, Math.round(this.currentSettings.particleCount * 0.7))
      this.currentSettings.renderScale = Math.max(0.5, this.currentSettings.renderScale * 0.9)
      this.notifyCallbacks()
    }
  }

  private checkNetworkConditions(): void {
    if (!this.config.networkAware) return

    const capabilities = this.deviceDetector.getCapabilities()
    if (capabilities?.network) {
      const { effectiveType, saveData } = capabilities.network

      // Reduce quality for poor network conditions
      if (saveData && this.currentSettings.level !== QualityLevel.LOW) {
        console.log('Data saver mode detected, reducing quality')
        this.setQualityLevel(QualityLevel.LOW)
      } else if (effectiveType === '2g' && this.currentSettings.level === QualityLevel.ULTRA) {
        console.log('Slow network detected, reducing quality from ULTRA')
        this.setQualityLevel(QualityLevel.MEDIUM)
      }
    }
  }

  setQualityLevel(level: QualityLevel): void {
    const capabilities = this.deviceDetector.getCapabilities()
    this.currentSettings = this.getSettingsForLevel(level, capabilities || undefined)
    this.notifyCallbacks()
  }

  setConfig(config: Partial<AdaptiveQualityConfig>): void {
    this.config = { ...this.config, ...config }

    if (this.adjustmentTimer) {
      this.startAdaptiveAdjustment()
    }
  }

  getCurrentSettings(): QualitySettings {
    return { ...this.currentSettings }
  }

  getConfig(): AdaptiveQualityConfig {
    return { ...this.config }
  }

  onSettingsChange(callback: (settings: QualitySettings) => void): () => void {
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
        callback(this.currentSettings)
      } catch (error) {
        console.error('Error in quality settings callback:', error)
      }
    })
  }

  // Manual quality override
  overrideSettings(settings: Partial<QualitySettings>): void {
    this.currentSettings = { ...this.currentSettings, ...settings }
    this.notifyCallbacks()
  }

  // Reset to automatic mode
  resetToAutomatic(): void {
    const capabilities = this.deviceDetector.getCapabilities()
    if (capabilities) {
      this.currentSettings = this.calculateOptimalSettings(capabilities)
      this.notifyCallbacks()
    }
  }

  dispose(): void {
    if (this.adjustmentTimer) {
      clearInterval(this.adjustmentTimer)
      this.adjustmentTimer = null
    }
    this.callbacks = []
    this.performanceHistory = []
  }
}
