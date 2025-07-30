/**
 * WASM Module Loader and Initialization System
 * Handles loading, caching, and error handling for WASM modules
 */

export interface WASMModule {
  initialize(): Promise<void>
  dispose(): void
  getMemoryUsage(): number
}

export interface WASMModuleConfig {
  name: string
  path: string
  fallbackAvailable: boolean
  sizeLimit?: number // in bytes
}

class WASMLoader {
  private modules = new Map<string, any>()
  private loadingPromises = new Map<string, Promise<any>>()
  private initialized = false

  async initialize(): Promise<void> {
    if (this.initialized) return

    // Check WASM support
    if (!this.isWASMSupported()) {
      console.warn('WASM not supported, falling back to JavaScript implementations')
      return
    }

    this.initialized = true
  }

  private isWASMSupported(): boolean {
    try {
      if (typeof WebAssembly === 'object' &&
          typeof WebAssembly.instantiate === 'function') {
        const module = new WebAssembly.Module(
          Uint8Array.of(0x0, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00)
        )
        if (module instanceof WebAssembly.Module) {
          return new WebAssembly.Instance(module) instanceof WebAssembly.Instance
        }
      }
    } catch (e) {
      console.warn('WASM support check failed:', e)
    }
    return false
  }

  async loadModule(config: WASMModuleConfig): Promise<any> {
    if (this.modules.has(config.name)) {
      return this.modules.get(config.name)
    }

    if (this.loadingPromises.has(config.name)) {
      return this.loadingPromises.get(config.name)
    }

    const loadPromise = this.loadModuleInternal(config)
    this.loadingPromises.set(config.name, loadPromise)

    try {
      const module = await loadPromise
      this.modules.set(config.name, module)
      this.loadingPromises.delete(config.name)
      return module
    } catch (error) {
      this.loadingPromises.delete(config.name)
      throw error
    }
  }

  private async loadModuleInternal(config: WASMModuleConfig): Promise<any> {
    try {
      // Check file size if limit is specified
      if (config.sizeLimit) {
        const response = await fetch(config.path, { method: 'HEAD' })
        const contentLength = response.headers.get('content-length')
        if (contentLength && parseInt(contentLength) > config.sizeLimit) {
          throw new Error(`WASM module ${config.name} exceeds size limit`)
        }
      }

      // Load the WASM module
      const wasmModule = await import(config.path)

      // Initialize if it has an init function
      if (typeof wasmModule.default === 'function') {
        await wasmModule.default()
      }

      console.log(`WASM module ${config.name} loaded successfully`)
      return wasmModule
    } catch (error) {
      console.error(`Failed to load WASM module ${config.name}:`, error)

      if (config.fallbackAvailable) {
        console.log(`Using JavaScript fallback for ${config.name}`)
        return null // Caller should handle fallback
      }

      throw error
    }
  }

  getModule(name: string): any | null {
    return this.modules.get(name) || null
  }

  unloadModule(name: string): void {
    const module = this.modules.get(name)
    if (module && typeof module.dispose === 'function') {
      module.dispose()
    }
    this.modules.delete(name)
  }

  dispose(): void {
    for (const [name] of this.modules) {
      this.unloadModule(name)
    }
    this.modules.clear()
    this.loadingPromises.clear()
    this.initialized = false
  }

  getLoadedModules(): string[] {
    return Array.from(this.modules.keys())
  }

  getTotalMemoryUsage(): number {
    let total = 0
    for (const module of this.modules.values()) {
      if (module && typeof module.getMemoryUsage === 'function') {
        total += module.getMemoryUsage()
      }
    }
    return total
  }
}

// Singleton instance
export const wasmLoader = new WASMLoader()

// Module configurations
export const WASM_MODULES: Record<string, WASMModuleConfig> = {
  CORE: {
    name: 'core',
    path: '/wasm/portfolio_wasm.js',
    fallbackAvailable: true,
    sizeLimit: 70 * 1024 // 70KB limit for core module (current size ~53KB)
  },
  IMAGE_PROCESSING: {
    name: 'image-processing',
    path: '/wasm/image_processing.js',
    fallbackAvailable: true,
    sizeLimit: 100 * 1024 // 100KB limit (to be implemented)
  },
  PHYSICS: {
    name: 'physics',
    path: '/wasm/physics.js',
    fallbackAvailable: true,
    sizeLimit: 75 * 1024 // 75KB limit (to be implemented)
  },
  CRYPTO: {
    name: 'crypto',
    path: '/wasm/crypto.js',
    fallbackAvailable: true,
    sizeLimit: 60 * 1024 // 60KB limit (to be implemented)
  }
}

// Utility functions
export async function initializeWASM(): Promise<void> {
  await wasmLoader.initialize()
}

export async function loadWASMModule(moduleName: keyof typeof WASM_MODULES): Promise<any> {
  const config = WASM_MODULES[moduleName]
  if (!config) {
    throw new Error(`Unknown WASM module: ${moduleName}`)
  }
  return wasmLoader.loadModule(config)
}

export function getWASMModule(moduleName: keyof typeof WASM_MODULES): any | null {
  return wasmLoader.getModule(WASM_MODULES[moduleName].name)
}

export function isWASMAvailable(): boolean {
  return typeof WebAssembly !== 'undefined'
}
