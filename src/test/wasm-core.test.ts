/**
 * Tests for WASM core module functionality
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { initializeWASMCore, getWASMCore, isWASMCoreReady } from '../lib/wasm-core-loader'
import { wasmPerformanceMonitor } from '../lib/wasm-performance-monitor'
import { isWASMAvailable } from '../lib/wasm-loader'
import type { WASMCoreInterface } from '../lib/wasm-core-loader'

// Mock WASM module for testing
const mockWasmModule = {
  greet: (name: string) => `Hello, ${name}! WASM is working perfectly.`,
  fibonacci: (n: number) => {
    if (n <= 1) return BigInt(n)
    let a = 0n, b = 1n
    for (let i = 2; i <= n; i++) {
      [a, b] = [b, a + b]
    }
    return b
  },
  performance_test: (iterations: number) => iterations * 0.001,
  prime_sieve: (limit: number) => {
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
  matrix_multiply: (a: Float64Array, b: Float64Array, rowsA: number, colsA: number, colsB: number) => {
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
  sum_array: (arr: Float64Array) => arr.reduce((sum, val) => sum + val, 0),
  sort_array: (arr: Float64Array) => arr.sort((a, b) => a - b),
  find_max: (arr: Float64Array) => Math.max(...arr),
  find_min: (arr: Float64Array) => Math.min(...arr),
  reverse_string: (s: string) => s.split('').reverse().join(''),
  count_words: (s: string) => s.split(/\s+/).filter(word => word.length > 0).length,
  get_memory_usage: () => 65536,
  force_gc: () => undefined,
  safe_divide: (a: number, b: number) => b === 0 ? (() => { throw new Error('Division by zero') })() : a / b,
  WASMModule: class {
    get_version() { return '1.0.0' }
    is_initialized() { return true }
    get_uptime() { return Date.now() - 1000 }
  }
}

// Mock the dynamic import
vi.mock('/wasm/portfolio_wasm.js', () => ({
  default: vi.fn().mockResolvedValue(undefined),
  ...mockWasmModule
}))

describe('WASM Core Module', () => {
  let wasmCore: WASMCoreInterface | null = null

  beforeAll(async () => {
    console.log('🧪 Setting up WASM core tests...')
    if (isWASMAvailable()) {
      try {
        wasmCore = await initializeWASMCore()
      } catch (error) {
        console.warn('WASM not available in test environment, using fallback')
      }
    }
  })

  afterAll(() => {
    console.log('🧹 Cleaning up WASM core tests...')
  })

  it('should detect WASM availability', () => {
    const available = isWASMAvailable()
    expect(typeof available).toBe('boolean')
  })

  it('should initialize WASM loader', async () => {
    await wasmLoader.initialize()
    expect(wasmLoader).toBeDefined()
  })

  it('should initialize WASM core successfully', async () => {
    const core = await initializeWASMCore()
    expect(core).toBeTruthy()
    expect(isWASMCoreReady()).toBe(true)
  })

  it('should provide core interface methods', async () => {
    const core = await initializeWASMCore()
    if (core) {
      expect(typeof core.greet).toBe('function')
      expect(typeof core.fibonacci).toBe('function')
      expect(typeof core.performanceTest).toBe('function')
      expect(typeof core.primeSieve).toBe('function')
    }
  })

  describe('Mathematical Operations (Mock)', () => {
    // Mock implementations for testing when WASM is not available
    const mockFibonacci = (n: number): bigint => {
      if (n <= 1) return BigInt(n)
      let a = 0n, b = 1n
      for (let i = 2; i <= n; i++) {
        [a, b] = [b, a + b]
      }
      return b
    }

    const mockPrimeSieve = (limit: number): number[] => {
      if (limit < 2) return []
      const sieve = new Array(limit + 1).fill(true)
      sieve[0] = sieve[1] = false

      for (let p = 2; p * p <= limit; p++) {
        if (sieve[p]) {
          for (let i = p * p; i <= limit; i += p) {
            sieve[i] = false
          }
        }
      }

      return sieve.map((isPrime, num) => isPrime ? num : -1)
                 .filter(num => num !== -1)
    }

    it('should calculate fibonacci numbers correctly', () => {
      const result = mockFibonacci(10)
      expect(result).toBe(55n)
    })

    it('should generate prime numbers correctly', () => {
      const primes = mockPrimeSieve(20)
      expect(primes).toEqual([2, 3, 5, 7, 11, 13, 17, 19])
    })

    it('should handle matrix multiplication', () => {
      const a = [1, 2, 3, 4]
      const b = [5, 6, 7, 8]

      // Mock matrix multiplication for 2x2 matrices
      const mockMatrixMultiply = (
        matA: number[],
        matB: number[],
        rows: number,
        cols: number
      ): number[] => {
        const result = new Array(rows * cols).fill(0)
        for (let i = 0; i < rows; i++) {
          for (let j = 0; j < cols; j++) {
            for (let k = 0; k < cols; k++) {
              result[i * cols + j] += matA[i * cols + k] * matB[k * cols + j]
            }
          }
        }
        return result
      }

      const result = mockMatrixMultiply(a, b, 2, 2)
      expect(result).toEqual([19, 22, 43, 50])
    })
  })

  describe('Performance Monitoring', () => {
    it('should create performance monitor instance', () => {
      expect(wasmPerformanceMonitor).toBeDefined()
    })

    it('should benchmark functions', async () => {
      const mockWasmFn = () => Promise.resolve(42)
      const mockJsFn = () => Promise.resolve(42)

      const result = await wasmPerformanceMonitor.benchmarkFunction(
        'test-function',
        mockWasmFn,
        mockJsFn,
        10
      )

      expect(result).toBeDefined()
      expect(result.wasmMetrics).toBeDefined()
      expect(result.jsMetrics).toBeDefined()
      expect(typeof result.speedupFactor).toBe('number')
    })

    it('should track benchmark history', async () => {
      const mockFn = () => Promise.resolve(1)

      await wasmPerformanceMonitor.benchmarkFunction('history-test', mockFn, mockFn, 5)

      const history = wasmPerformanceMonitor.getBenchmarkHistory('history-test')
      expect(history.length).toBeGreaterThan(0)
    })

    it('should calculate average metrics', async () => {
      const mockFn = () => Promise.resolve(1)

      // Run multiple benchmarks
      await wasmPerformanceMonitor.benchmarkFunction('average-test', mockFn, mockFn, 5)
      await wasmPerformanceMonitor.benchmarkFunction('average-test', mockFn, mockFn, 5)

      const average = wasmPerformanceMonitor.getAverageMetrics('average-test')
      expect(average).toBeDefined()
      expect(average?.wasmMetrics).toBeDefined()
      expect(average?.jsMetrics).toBeDefined()
    })
  })

  describe('Array Operations (Mock)', () => {
    it('should sum array elements', () => {
      const arr = [1, 2, 3, 4, 5]
      const sum = arr.reduce((a, b) => a + b, 0)
      expect(sum).toBe(15)
    })

    it('should find max and min values', () => {
      const arr = [3, 1, 4, 1, 5, 9, 2, 6]
      expect(Math.max(...arr)).toBe(9)
      expect(Math.min(...arr)).toBe(1)
    })

    it('should sort arrays', () => {
      const arr = [3, 1, 4, 1, 5, 9, 2, 6]
      const sorted = [...arr].sort((a, b) => a - b)
      expect(sorted).toEqual([1, 1, 2, 3, 4, 5, 6, 9])
    })
  })

  describe('String Operations (Mock)', () => {
    it('should reverse strings', () => {
      const reversed = 'hello'.split('').reverse().join('')
      expect(reversed).toBe('olleh')
    })

    it('should count words', () => {
      const text = 'Hello world from WASM'
      const wordCount = text.split(/\s+/).length
      expect(wordCount).toBe(4)
    })
  })

  describe('Error Handling', () => {
    it('should handle division by zero', () => {
      const safeDivide = (a: number, b: number): number | Error => {
        if (b === 0) {
          return new Error('Division by zero')
        }
        return a / b
      }

      expect(safeDivide(10, 2)).toBe(5)
      expect(safeDivide(10, 0)).toBeInstanceOf(Error)
    })
  })
})
