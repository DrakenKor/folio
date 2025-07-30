/**
 * WASM Initialization System
 * Handles progressive loading and initialization of all WASM modules
 * with performance monitoring and fallback support
 */

import { wasmModuleManager, initializeWASMModules } from './wasm-module-manager'
import { wasmCoreLoader, initializeWASMCore } from './wasm-core-loader'
import type { WASMModuleInstance, WASMPerformanceResult } from '../types/wasm'

export interface WASMInitializationConfig {
  enableProgressiveLoading: boolean
  enablePerformanceMonitoring: boolean
  enableFallbacks: boolean
  maxInitializationTime: number // milliseconds
  sizeLimit: number // bytes
}

export interface WASMInitializationStatus {
  initialized: boolean
  coreLoaded: boolean
  modulesLoaded: string[]
  failedModules: string[]
  totalLoadTime: number
  totalSize: number
  performanceMetrics: Map<string, WASMPerformanceResult>
}

class WASMInitializationSystem {
  private config: WASMInitializationConfig
  private status: WASMInitializationStatus
  private initializationPromise: Promise<void> | null = null

  constructor(config: Partial<WASMInitializationConfig> = {}) {
    this.config = {
      enableProgressiveLoading: true,
      enablePerformanceMonitoring: true,
      enableFallbacks: true,
      maxInitializationTime: 5000, // 5 seconds
      sizeLimit: 500 * 1024, // 500KB
      ...config
    }

    this.status = {
      initialized: false,
      coreLoaded: false,
      modulesLoaded: [],
      failedModules: [],
      totalLoadTime: 0,
      totalSize: 0,
      performanceMetrics: new Map()
    }
  }

  async initialize(): Promise<WASMInitializationStatus> {
    if (this.initializationPromise) {
      await this.initializationPromise
      return this.status
    }

    this.initializationPromise = this.performInitialization()
    await this.initializationPromise
    return this.status
  }

  private async performInitialization(): Promise<void> {
    const startTime = performance.now()

    try {
      console.log('🚀 Starting WASM initialization system...')

      // Initialize module manager first
      await this.initializeModuleManager()

      // Load core module
      await this.loadCoreModule()

      // Progressive loading of additional modules if enabled
      if (this.config.enableProgressiveLoading) {
        await this.loadAdditionalModules()
      }

      const endTime = performance.now()
      this.status.totalLoadTime = endTime - startTime
      this.status.initialized = true

      console.log(`✅ WASM initialization completed in ${this.status.totalLoadTime.toFixed(2)}ms`)
      this.logInitializationSummary()

    } catch (error) {
      console.error('❌ WASM initialization failed:', error)

      if (this.config.enableFallbacks) {
        console.log('🔄 Enabling fallback mode...')
        this.enableFallbackMode()
      } else {
        throw error
      }
    }
  }

  private async initializeModuleManager(): Promise<void> {
    try {
      await initializeWASMModules()
      console.log('✅ WASM module manager initialized')
    } catch (error) {
      console.error('❌ Failed to initialize WASM module manager:', error)
      throw error
    }
  }

  private async loadCoreModule(): Promise<void> {
    try {
      const coreInterface = await initializeWASMCore()

      if (coreInterface) {
        this.status.coreLoaded = true
        this.status.modulesLoaded.push('core')
        console.log('✅ Core WASM module loaded')

        // Performance test if monitoring is enabled
        if (this.config.enablePerformanceMonitoring) {
          await this.performCorePerformanceTest(coreInterface)
        }
      } else {
        console.warn('⚠️ Core WASM module not available, using fallback')
        this.status.failedModules.push('core')
      }
    } catch (error) {
      console.error('❌ Failed to load core WASM module:', error)
      this.status.failedModules.push('core')
    }
  }

  private async loadAdditionalModules(): Promise<void> {
    const additionalModules = ['image-processing', 'physics', 'crypto']

    // Load modules in parallel but with size constraints
    const loadPromises = additionalModules.map(async (moduleName) => {
      try {
        // Check size constraints before loading
        if (this.wouldExceedSizeLimit()) {
          console.warn(`⚠️ Skipping ${moduleName} module due to size constraints`)
          return
        }

        const module = await wasmModuleManager.loadModule(moduleName)

        if (module) {
          this.status.modulesLoaded.push(moduleName)
          console.log(`✅ ${moduleName} module loaded`)
        } else {
          this.status.failedModules.push(moduleName)
          console.warn(`⚠️ ${moduleName} module not available`)
        }
      } catch (error) {
        console.error(`❌ Failed to load ${moduleName} module:`, error)
        this.status.failedModules.push(moduleName)
      }
    })

    await Promise.allSettled(loadPromises)
  }

  private async performCorePerformanceTest(coreInterface: any): Promise<void> {
    try {
      console.log('🧪 Running WASM performance tests...')

      // Test mathematical operations
      const iterations = 10000
      const wasmTime = coreInterface.performanceTest(iterations)

      // JavaScript equivalent for comparison
      const jsStart = performance.now()
      let sum = 0
      for (let i = 0; i < iterations; i++) {
        sum += Math.sin(i) * Math.cos(i) * Math.tan(i)
      }
      const jsTime = performance.now() - jsStart

      const speedup = jsTime / wasmTime
      const memoryUsage = coreInterface.getMemoryUsage()

      const performanceResult: WASMPerformanceResult = {
        wasmTime,
        jsTime,
        speedup,
        memoryUsage,
        operationsPerSecond: iterations / (wasmTime / 1000)
      }

      this.status.performanceMetrics.set('core', performanceResult)

      console.log(`📊 Performance test results:`)
      console.log(`   WASM: ${wasmTime.toFixed(2)}ms`)
      console.log(`   JS: ${jsTime.toFixed(2)}ms`)
      console.log(`   Speedup: ${speedup.toFixed(2)}x`)
      console.log(`   Memory: ${memoryUsage} bytes`)

    } catch (error) {
      console.warn('⚠️ Performance test failed:', error)
    }
  }

  private wouldExceedSizeLimit(): boolean {
    const currentSize = wasmModuleManager.getTotalSize()
    return currentSize > this.config.sizeLimit
  }

  private enableFallbackMode(): void {
    console.log('🔄 Enabling JavaScript fallback mode for all WASM operations')
    this.status.initialized = true
    // All operations will use JavaScript implementations
  }

  private logInitializationSummary(): void {
    console.log('\n📋 WASM Initialization Summary:')
    console.log('================================')
    console.log(`✅ Modules loaded: ${this.status.modulesLoaded.join(', ')}`)

    if (this.status.failedModules.length > 0) {
      console.log(`❌ Failed modules: ${this.status.failedModules.join(', ')}`)
    }

    console.log(`⏱️  Total load time: ${this.status.totalLoadTime.toFixed(2)}ms`)
    console.log(`💾 Total memory usage: ${wasmModuleManager.getTotalMemoryUsage()} bytes`)
    console.log(`📦 Total size: ${wasmModuleManager.getTotalSize()} bytes`)

    if (this.status.performanceMetrics.size > 0) {
      console.log('\n📊 Performance Metrics:')
      for (const [module, metrics] of this.status.performanceMetrics) {
        console.log(`   ${module}: ${metrics.speedup.toFixed(2)}x speedup`)
      }
    }

    console.log('================================\n')
  }

  getStatus(): WASMInitializationStatus {
    return { ...this.status }
  }

  isModuleLoaded(moduleName: string): boolean {
    return this.status.modulesLoaded.includes(moduleName)
  }

  getModule(moduleName: string): WASMModuleInstance | null {
    if (!this.isModuleLoaded(moduleName)) {
      return null
    }
    return wasmModuleManager.getModule(moduleName)
  }

  async loadModuleOnDemand(moduleName: string): Promise<WASMModuleInstance | null> {
    if (this.isModuleLoaded(moduleName)) {
      return this.getModule(moduleName)
    }

    try {
      const module = await wasmModuleManager.loadModule(moduleName)
      if (module) {
        this.status.modulesLoaded.push(moduleName)
        // Remove from failed list if it was there
        const failedIndex = this.status.failedModules.indexOf(moduleName)
        if (failedIndex > -1) {
          this.status.failedModules.splice(failedIndex, 1)
        }
      }
      return module
    } catch (error) {
      console.error(`❌ Failed to load ${moduleName} on demand:`, error)
      if (!this.status.failedModules.includes(moduleName)) {
        this.status.failedModules.push(moduleName)
      }
      return null
    }
  }

  dispose(): void {
    wasmModuleManager.dispose()
    wasmCoreLoader.dispose()
    this.status = {
      initialized: false,
      coreLoaded: false,
      modulesLoaded: [],
      failedModules: [],
      totalLoadTime: 0,
      totalSize: 0,
      performanceMetrics: new Map()
    }
    this.initializationPromise = null
  }
}

// Singleton instance
export const wasmInitializationSystem = new WASMInitializationSystem()

// Convenience functions
export async function initializeWASMSystem(
  config?: Partial<WASMInitializationConfig>
): Promise<WASMInitializationStatus> {
  if (config) {
    // Create new instance with custom config
    const customSystem = new WASMInitializationSystem(config)
    return customSystem.initialize()
  }

  return wasmInitializationSystem.initialize()
}

export function getWASMSystemStatus(): WASMInitializationStatus {
  return wasmInitializationSystem.getStatus()
}

export function isWASMModuleReady(moduleName: string): boolean {
  return wasmInitializationSystem.isModuleLoaded(moduleName)
}

export async function loadWASMModuleOnDemand(moduleName: string): Promise<WASMModuleInstance | null> {
  return wasmInitializationSystem.loadModuleOnDemand(moduleName)
}

export function getWASMModuleInstance(moduleName: string): WASMModuleInstance | null {
  return wasmInitializationSystem.getModule(moduleName)
}
