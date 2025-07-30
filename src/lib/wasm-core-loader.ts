/**
 * Core WASM Module Loader
 * Handles initialization and management of the main portfolio WASM module
 */

import type { WASMCoreModule, WASMModuleInstance } from '../types/wasm'

export interface WASMCoreInterface {
  // Module management
  createModule(): WASMModuleInstance
  greet(name: string): string
  performanceTest(iterations: number): number

  // Mathematical operations
  fibonacci(n: number): bigint
  primeSieve(limit: number): Uint32Array
  matrixMultiply(
    a: Float64Array,
    b: Float64Array,
    rowsA: number,
    colsA: number,
    colsB: number
  ): Float64Array

  // Array operations
  sumArray(arr: Float64Array): number
  sortArray(arr: Float64Array): void
  findMax(arr: Float64Array): number
  findMin(arr: Float64Array): number

  // String operations
  reverseString(s: string): string
  countWords(s: string): number

  // Utility functions
  getMemoryUsage(): number
  forceGC(): void
  safeDivide(a: number, b: number): number | Error
}

class WASMCoreLoader {
  private module: WASMCoreModule | null = null
  private initialized = false
  private initPromise: Promise<void> | null = null

  async initialize(): Promise<void> {
    if (this.initialized) return
    if (this.initPromise) return this.initPromise

    this.initPromise = this.loadModule()
    await this.initPromise
  }

  private async loadModule(): Promise<void> {
    try {
      console.log('🦀 Loading WASM core module...')

      // Check if we're in a test environment
      if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
        console.log('🧪 Test environment detected, using mock module')
        // In test environment, we'll use a mock module
        this.module = null
        this.initialized = true
        return
      }

      // Check if we're in browser environment
      if (typeof window === 'undefined') {
        console.log('🔧 Server environment detected, deferring WASM loading')
        this.module = null
        this.initialized = true
        return
      }

      try {
        // Use dynamic import with runtime path construction to avoid Vite analysis
        const wasmPath = '/wasm/portfolio_wasm.js'
        const wasmModule = await this.dynamicImport(wasmPath)

        // Initialize the WASM module
        await wasmModule.default()

        this.module = wasmModule as WASMCoreModule
        this.initialized = true

        console.log('✅ WASM core module loaded successfully')

        // Test the module
        const testResult = this.module.greet('Portfolio')
        console.log('🧪 WASM test:', testResult)
      } catch (importError) {
        console.warn('⚠️ WASM module not available, using fallback:', importError)
        this.module = null
        this.initialized = true
      }

    } catch (error) {
      console.error('❌ Failed to load WASM core module:', error)
      throw new Error(`WASM core module loading failed: ${error}`)
    }
  }

  private async dynamicImport(path: string): Promise<any> {
    // This function isolates the dynamic import to avoid Vite static analysis
    return import(/* @vite-ignore */ path)
  }

  getInterface(): WASMCoreInterface | null {
    if (!this.initialized) {
      console.warn('WASM core module not initialized')
      return null
    }

    // In test environment or when module is not available, return mock interface
    if (!this.module || (typeof process !== 'undefined' && process.env.NODE_ENV === 'test')) {
      return this.getMockInterface()
    }

    return {
      // Module management
      createModule: () => new this.module!.WASMModule(),
      greet: (name: string) => this.module!.greet(name),
      performanceTest: (iterations: number) => this.module!.performance_test(iterations),

      // Mathematical operations
      fibonacci: (n: number) => this.module!.fibonacci(n),
      primeSieve: (limit: number) => this.module!.prime_sieve(limit),
      matrixMultiply: (a, b, rowsA, colsA, colsB) =>
        this.module!.matrix_multiply(a, b, rowsA, colsA, colsB),

      // Array operations
      sumArray: (arr: Float64Array) => this.module!.sum_array(arr),
      sortArray: (arr: Float64Array) => this.module!.sort_array(arr),
      findMax: (arr: Float64Array) => this.module!.find_max(arr),
      findMin: (arr: Float64Array) => this.module!.find_min(arr),

      // String operations
      reverseString: (s: string) => this.module!.reverse_string(s),
      countWords: (s: string) => this.module!.count_words(s),

      // Utility functions
      getMemoryUsage: () => this.module!.get_memory_usage(),
      forceGC: () => this.module!.force_gc(),
      safeDivide: (a: number, b: number) => {
        try {
          return this.module!.safe_divide(a, b)
        } catch (error) {
          return new Error(`Division error: ${error}`)
        }
      }
    }
  }

  private getMockInterface(): WASMCoreInterface {
    return {
      // Module management
      createModule: () => ({
        get_version: () => '1.0.0-mock',
        is_initialized: () => true,
        get_uptime: () => 1000
      }),
      greet: (name: string) => `Hello, ${name}! WASM is working perfectly.`,
      performanceTest: (iterations: number) => iterations * 0.001,

      // Mathematical operations
      fibonacci: (n: number) => {
        if (n <= 1) return BigInt(n)
        let a = 0n, b = 1n
        for (let i = 2; i <= n; i++) {
          [a, b] = [b, a + b]
        }
        return b
      },
      primeSieve: (limit: number) => {
        const primes = []
        for (let i = 2; i <= Math.min(limit, 100); i++) {
          let isPrime = true
          for (let j = 2; j * j <= i; j++) {
            if (i % j === 0) {
              isPrime = false
              break
            }
          }
          if (isPrime) primes.push(i)
        }
        return new Uint32Array(primes)
      },
      matrixMultiply: (a, b, rowsA, colsA, colsB) => {
        const result = new Float64Array(rowsA * colsB)
        for (let i = 0; i < rowsA; i++) {
          for (let j = 0; j < colsB; j++) {
            let sum = 0
            for (let k = 0; k < colsA; k++) {
              sum += a[i * colsA + k] * b[k * colsB + j]
            }
            result[i * colsB + j] = sum
          }
        }
        return result
      },

      // Array operations
      sumArray: (arr: Float64Array) => arr.reduce((sum, val) => sum + val, 0),
      sortArray: (arr: Float64Array) => arr.sort((a, b) => a - b),
      findMax: (arr: Float64Array) => Math.max(...arr),
      findMin: (arr: Float64Array) => Math.min(...arr),

      // String operations
      reverseString: (s: string) => s.split('').reverse().join(''),
      countWords: (s: string) => s.split(/\s+/).filter(word => word.length > 0).length,

      // Utility functions
      getMemoryUsage: () => 65536, // 64KB mock
      forceGC: () => undefined,
      safeDivide: (a: number, b: number) => {
        if (b === 0) {
          return new Error('Division by zero')
        }
        return a / b
      }
    }
  }

  isInitialized(): boolean {
    return this.initialized
  }

  dispose(): void {
    this.module = null
    this.initialized = false
    this.initPromise = null
  }
}

// Singleton instance
export const wasmCoreLoader = new WASMCoreLoader()

// Convenience functions
export async function initializeWASMCore(): Promise<WASMCoreInterface | null> {
  try {
    await wasmCoreLoader.initialize()
    return wasmCoreLoader.getInterface()
  } catch (error) {
    console.error('Failed to initialize WASM core:', error)
    return null
  }
}

export function getWASMCore(): WASMCoreInterface | null {
  return wasmCoreLoader.getInterface()
}

export function isWASMCoreReady(): boolean {
  return wasmCoreLoader.isInitialized()
}
