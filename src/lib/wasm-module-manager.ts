/* eslint-disable @next/next/no-assign-module-variable */
/**
 * WASM Module Manager
 * Centralized system for managing all WASM modules with size optimization
 * and performance monitoring for GitHub Pages constraints
 */

import type { WASMModuleConfig, WASMModuleInstance } from '../types/wasm'

export interface WASMModuleManager {
  initialize(): Promise<void>
  loadModule(name: string): Promise<WASMModuleInstance | null>
  unloadModule(name: string): void
  getModule(name: string): WASMModuleInstance | null
  getAllModules(): Map<string, WASMModuleInstance>
  getTotalMemoryUsage(): number
  getTotalSize(): number
  dispose(): void
}

export interface WASMPerformanceMetrics {
  loadTime: number
  memoryUsage: number
  moduleSize: number
  compressionRatio: number
  initializationTime: number
}

class WASMModuleManagerImpl implements WASMModuleManager {
  private modules = new Map<string, WASMModuleInstance>()
  private loadingPromises = new Map<string, Promise<WASMModuleInstance | null>>()
  private performanceMetrics = new Map<string, WASMPerformanceMetrics>()
  private initialized = false
  private totalSizeLimit = 500 * 1024 // 500KB total limit for all WASM modules

  async initialize(): Promise<void> {
    if (this.initialized) return

    console.log('🦀 Initializing WASM Module Manager...')

    // Check WASM support
    if (!this.isWASMSupported()) {
      console.warn('⚠️ WASM not supported, using JavaScript fallbacks')
      this.initialized = true
      return
    }

    // Pre-warm the core module
    try {
      await this.loadModule('core')
      console.log('✅ WASM Module Manager initialized successfully')
    } catch (error) {
      console.warn('⚠️ Core WASM module failed to load, continuing with fallbacks:', error)
    }

    this.initialized = true
  }

  async loadModule(name: string): Promise<WASMModuleInstance | null> {
    if (this.modules.has(name)) {
      return this.modules.get(name)!
    }

    if (this.loadingPromises.has(name)) {
      return this.loadingPromises.get(name)!
    }

    const config = this.getModuleConfig(name)
    if (!config) {
      console.error(`❌ Unknown WASM module: ${name}`)
      return null
    }

    const loadPromise = this.loadModuleInternal(config)
    this.loadingPromises.set(name, loadPromise)

    try {
      const module = await loadPromise
      if (module) {
        this.modules.set(name, module)
      }
      this.loadingPromises.delete(name)
      return module
    } catch (error) {
      this.loadingPromises.delete(name)
      console.error(`❌ Failed to load WASM module ${name}:`, error)
      return null
    }
  }

  private async loadModuleInternal(config: WASMModuleConfig): Promise<WASMModuleInstance | null> {
    const startTime = performance.now()

    try {
      // Check size constraints before loading
      if (await this.wouldExceedSizeLimit(config)) {
        throw new Error(`Loading ${config.name} would exceed total size limit`)
      }

      // Load the module
      const module = await this.dynamicImport(config.path)

      // Initialize if needed
      if (typeof module.default === 'function') {
        await module.default()
      }

      const loadTime = performance.now() - startTime
      const initStart = performance.now()

      // Create module instance
      const instance: WASMModuleInstance = {
        name: config.name,
        module,
        initialized: true,
        memoryUsage: this.getModuleMemoryUsage(module),
        dispose: () => this.disposeModule(config.name)
      }

      const initTime = performance.now() - initStart

      // Record performance metrics
      this.performanceMetrics.set(config.name, {
        loadTime,
        memoryUsage: instance.memoryUsage,
        moduleSize: config.estimatedSize || 0,
        compressionRatio: config.compressionRatio || 1,
        initializationTime: initTime
      })

      console.log(`✅ WASM module ${config.name} loaded in ${loadTime.toFixed(2)}ms`)
      return instance

    } catch (error) {
      console.error(`❌ Failed to load WASM module ${config.name}:`, error)

      if (config.fallbackAvailable) {
        console.log(`🔄 Using JavaScript fallback for ${config.name}`)
        return this.createFallbackInstance(config)
      }

      throw error
    }
  }

  private async wouldExceedSizeLimit(config: WASMModuleConfig): Promise<boolean> {
    const currentSize = this.getTotalSize()
    const estimatedSize = config.estimatedSize || 50 * 1024 // Default 50KB estimate
    return (currentSize + estimatedSize) > this.totalSizeLimit
  }

  private async dynamicImport(path: string): Promise<any> {
    // For Next.js, we need to handle WASM loading differently
    if (typeof window !== 'undefined') {
      // Client-side: load from public directory
      const wasmPath = path.replace('.js', '_bg.wasm')
      const jsPath = path

      // Load the JS wrapper first
      const script = document.createElement('script')
      script.src = jsPath
      document.head.appendChild(script)

      // Wait for script to load
      await new Promise((resolve, reject) => {
        script.onload = resolve
        script.onerror = reject
      })

      // Return the global WASM module
      return (window as any).wasm_bindgen || {}
    } else {
      // Server-side: return empty module for SSR
      return {}
    }
  }

  private getModuleMemoryUsage(module: any): number {
    if (module && typeof module.get_memory_usage === 'function') {
      return module.get_memory_usage()
    }
    return 0
  }

  private createFallbackInstance(config: WASMModuleConfig): WASMModuleInstance {
    return {
      name: config.name,
      module: null,
      initialized: true,
      memoryUsage: 0,
      dispose: () => {}
    }
  }

  private disposeModule(name: string): void {
    const instance = this.modules.get(name)
    if (instance && instance.module) {
      // Call module-specific cleanup if available
      if (typeof instance.module.dispose === 'function') {
        instance.module.dispose()
      }
    }
    this.modules.delete(name)
    this.performanceMetrics.delete(name)
  }

  unloadModule(name: string): void {
    this.disposeModule(name)
  }

  getModule(name: string): WASMModuleInstance | null {
    return this.modules.get(name) || null
  }

  getAllModules(): Map<string, WASMModuleInstance> {
    return new Map(this.modules)
  }

  getTotalMemoryUsage(): number {
    let total = 0
    for (const instance of this.modules.values()) {
      total += instance.memoryUsage
    }
    return total
  }

  getTotalSize(): number {
    let total = 0
    for (const [name] of this.modules) {
      const metrics = this.performanceMetrics.get(name)
      if (metrics) {
        total += metrics.moduleSize
      }
    }
    return total
  }

  getPerformanceMetrics(): Map<string, WASMPerformanceMetrics> {
    return new Map(this.performanceMetrics)
  }

  private isWASMSupported(): boolean {
    try {
      if (typeof WebAssembly === 'object' &&
          typeof WebAssembly.instantiate === 'function') {
        const module = new WebAssembly.Module(
          Uint8Array.of(0x0, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00)
        )
        return module instanceof WebAssembly.Module &&
               new WebAssembly.Instance(module) instanceof WebAssembly.Instance
      }
    } catch (e) {
      // WASM not supported
    }
    return false
  }

  private getModuleConfig(name: string): WASMModuleConfig | null {
    const configs: Record<string, WASMModuleConfig> = {
      core: {
        name: 'core',
        path: '/wasm/portfolio_wasm.js',
        fallbackAvailable: true,
        estimatedSize: 53 * 1024, // Current size
        compressionRatio: 0.7,
        sizeLimit: 70 * 1024
      },
      'image-processing': {
        name: 'image-processing',
        path: '/wasm/image_processing.js',
        fallbackAvailable: true,
        estimatedSize: 80 * 1024,
        compressionRatio: 0.6,
        sizeLimit: 100 * 1024
      },
      physics: {
        name: 'physics',
        path: '/wasm/physics.js',
        fallbackAvailable: true,
        estimatedSize: 60 * 1024,
        compressionRatio: 0.65,
        sizeLimit: 75 * 1024
      },
      crypto: {
        name: 'crypto',
        path: '/wasm/crypto.js',
        fallbackAvailable: true,
        estimatedSize: 45 * 1024,
        compressionRatio: 0.7,
        sizeLimit: 60 * 1024
      }
    }

    return configs[name] || null
  }

  dispose(): void {
    for (const [name] of this.modules) {
      this.disposeModule(name)
    }
    this.modules.clear()
    this.loadingPromises.clear()
    this.performanceMetrics.clear()
    this.initialized = false
  }
}

// Singleton instance
export const wasmModuleManager = new WASMModuleManagerImpl()

// Convenience functions
export async function initializeWASMModules(): Promise<void> {
  await wasmModuleManager.initialize()
}

export async function loadWASMModule(name: string): Promise<WASMModuleInstance | null> {
  return wasmModuleManager.loadModule(name)
}

export function getWASMModule(name: string): WASMModuleInstance | null {
  return wasmModuleManager.getModule(name)
}

export function getWASMPerformanceReport(): {
  totalMemory: number
  totalSize: number
  moduleCount: number
  metrics: Map<string, WASMPerformanceMetrics>
} {
  return {
    totalMemory: wasmModuleManager.getTotalMemoryUsage(),
    totalSize: wasmModuleManager.getTotalSize(),
    moduleCount: wasmModuleManager.getAllModules().size,
    metrics: wasmModuleManager.getPerformanceMetrics()
  }
}
