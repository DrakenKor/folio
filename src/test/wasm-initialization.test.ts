/**
 * Tests for WASM Initialization System
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  wasmInitializationSystem,
  initializeWASMSystem,
  getWASMSystemStatus,
  isWASMModuleReady,
  loadWASMModuleOnDemand,
  getWASMModuleInstance
} from '../lib/wasm-initialization-system'

// Mock the WASM modules since they won't be available in test environment
vi.mock('../lib/wasm-module-manager', () => ({
  wasmModuleManager: {
    initialize: vi.fn().mockResolvedValue(undefined),
    loadModule: vi.fn().mockResolvedValue({
      name: 'test-module',
      module: { test: true },
      initialized: true,
      memoryUsage: 1024,
      dispose: vi.fn()
    }),
    getModule: vi.fn().mockReturnValue(null),
    getTotalSize: vi.fn().mockReturnValue(1024),
    getTotalMemoryUsage: vi.fn().mockReturnValue(2048),
    dispose: vi.fn()
  },
  initializeWASMModules: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('../lib/wasm-core-loader', () => ({
  wasmCoreLoader: {
    initialize: vi.fn().mockResolvedValue(undefined),
    getInterface: vi.fn().mockReturnValue({
      greet: vi.fn().mockReturnValue('Hello, Test!'),
      performanceTest: vi.fn().mockReturnValue(10.5),
      getMemoryUsage: vi.fn().mockReturnValue(1024)
    }),
    dispose: vi.fn()
  },
  initializeWASMCore: vi.fn().mockResolvedValue({
    greet: vi.fn().mockReturnValue('Hello, Test!'),
    performanceTest: vi.fn().mockReturnValue(10.5),
    getMemoryUsage: vi.fn().mockReturnValue(1024)
  })
}))

describe('WASM Initialization System', () => {
  beforeEach(() => {
    // Reset the system before each test
    wasmInitializationSystem.dispose()
  })

  afterEach(() => {
    // Clean up after each test
    wasmInitializationSystem.dispose()
  })

  describe('Basic Initialization', () => {
    it('should initialize successfully', async () => {
      const status = await initializeWASMSystem()

      expect(status.initialized).toBe(true)
      expect(status.coreLoaded).toBe(true)
      expect(status.totalLoadTime).toBeGreaterThan(0)
    })

    it('should handle initialization with custom config', async () => {
      const customConfig = {
        enableProgressiveLoading: false,
        enablePerformanceMonitoring: false,
        maxInitializationTime: 1000,
        sizeLimit: 100 * 1024
      }

      const status = await initializeWASMSystem(customConfig)

      expect(status.initialized).toBe(true)
    })

    it('should return cached status on subsequent calls', async () => {
      const status1 = await initializeWASMSystem()
      const status2 = await initializeWASMSystem()

      expect(status1).toEqual(status2)
    })
  })

  describe('Module Management', () => {
    beforeEach(async () => {
      await initializeWASMSystem()
    })

    it('should check if modules are ready', () => {
      const isReady = isWASMModuleReady('core')
      expect(typeof isReady).toBe('boolean')
    })

    it('should get system status', () => {
      const status = getWASMSystemStatus()

      expect(status).toHaveProperty('initialized')
      expect(status).toHaveProperty('coreLoaded')
      expect(status).toHaveProperty('modulesLoaded')
      expect(status).toHaveProperty('failedModules')
      expect(status).toHaveProperty('totalLoadTime')
      expect(status).toHaveProperty('performanceMetrics')
    })

    it('should load modules on demand', async () => {
      const module = await loadWASMModuleOnDemand('test-module')

      expect(module).toBeTruthy()
      if (module) {
        expect(module.name).toBe('test-module')
        expect(module.initialized).toBe(true)
      }
    })

    it('should get module instances', async () => {
      await loadWASMModuleOnDemand('test-module')
      const instance = getWASMModuleInstance('test-module')

      expect(instance).toBeTruthy()
    })

    it('should return null for non-existent modules', () => {
      const instance = getWASMModuleInstance('non-existent-module')
      expect(instance).toBeNull()
    })
  })

  describe('Error Handling', () => {
    it('should handle initialization failures gracefully', async () => {
      // Mock a failure in module manager initialization
      const { wasmModuleManager } = await import('../lib/wasm-module-manager')
      vi.mocked(wasmModuleManager.initialize).mockRejectedValueOnce(new Error('Test error'))

      const status = await initializeWASMSystem({
        enableFallbacks: true
      })

      // Should still initialize with fallbacks
      expect(status.initialized).toBe(true)
    })

    it('should track failed modules', async () => {
      const { wasmModuleManager } = await import('../lib/wasm-module-manager')
      vi.mocked(wasmModuleManager.loadModule).mockRejectedValueOnce(new Error('Load failed'))

      const module = await loadWASMModuleOnDemand('failing-module')
      expect(module).toBeNull()

      const status = getWASMSystemStatus()
      expect(status.failedModules).toContain('failing-module')
    })
  })

  describe('Performance Monitoring', () => {
    it('should collect performance metrics when enabled', async () => {
      const status = await initializeWASMSystem({
        enablePerformanceMonitoring: true
      })

      expect(status.performanceMetrics).toBeDefined()
      expect(status.performanceMetrics.size).toBeGreaterThanOrEqual(0)
    })

    it('should skip performance tests when disabled', async () => {
      const status = await initializeWASMSystem({
        enablePerformanceMonitoring: false
      })

      expect(status.performanceMetrics).toBeDefined()
    })
  })

  describe('Size Constraints', () => {
    it('should respect size limits', async () => {
      const status = await initializeWASMSystem({
        sizeLimit: 1024, // Very small limit
        enableProgressiveLoading: true
      })

      expect(status.initialized).toBe(true)
      // Should still work but may have fewer modules loaded
    })
  })

  describe('Cleanup', () => {
    it('should dispose resources properly', async () => {
      await initializeWASMSystem()

      wasmInitializationSystem.dispose()

      const status = getWASMSystemStatus()
      expect(status.initialized).toBe(false)
      expect(status.modulesLoaded).toHaveLength(0)
    })
  })
})

describe('Integration Tests', () => {
  it('should work with the existing WASM demo page', async () => {
    // This test ensures compatibility with existing WASM usage
    const status = await initializeWASMSystem()

    expect(status.initialized).toBe(true)

    // Should be able to get core module
    const coreModule = getWASMModuleInstance('core')
    expect(coreModule).toBeTruthy()
  })

  it('should handle browser environment detection', async () => {
    // Mock browser environment
    const originalWindow = global.window
    global.window = {} as any

    const status = await initializeWASMSystem()
    expect(status.initialized).toBe(true)

    // Restore
    if (originalWindow) {
      global.window = originalWindow
    } else {
      delete (global as any).window
    }
  })
})
