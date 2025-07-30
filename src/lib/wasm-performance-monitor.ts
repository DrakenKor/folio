/**
 * WASM Performance Monitoring System
 * Tracks performance metrics and compares WASM vs JavaScript implementations
 */

export interface PerformanceMetrics {
  executionTime: number
  memoryUsage: number
  operationsPerSecond: number
  timestamp: number
}

export interface BenchmarkResult {
  wasmMetrics?: PerformanceMetrics
  jsMetrics?: PerformanceMetrics
  speedupFactor?: number
  memoryEfficiency?: number
}

export class WASMPerformanceMonitor {
  private benchmarkHistory: Map<string, BenchmarkResult[]> = new Map()

  async benchmarkFunction<T>(
    name: string,
    wasmFn?: () => Promise<T> | T,
    jsFn?: () => Promise<T> | T,
    iterations: number = 1000
  ): Promise<BenchmarkResult> {
    const result: BenchmarkResult = {}

    // Benchmark WASM implementation
    if (wasmFn) {
      result.wasmMetrics = await this.measurePerformance(wasmFn, iterations)
    }

    // Benchmark JavaScript implementation
    if (jsFn) {
      result.jsMetrics = await this.measurePerformance(jsFn, iterations)
    }

    // Calculate comparison metrics
    if (result.wasmMetrics && result.jsMetrics) {
      result.speedupFactor = result.jsMetrics.executionTime / result.wasmMetrics.executionTime
      result.memoryEfficiency = result.jsMetrics.memoryUsage / result.wasmMetrics.memoryUsage
    }

    // Store in history
    if (!this.benchmarkHistory.has(name)) {
      this.benchmarkHistory.set(name, [])
    }
    this.benchmarkHistory.get(name)!.push(result)

    return result
  }

  private async measurePerformance<T>(
    fn: () => Promise<T> | T,
    iterations: number
  ): Promise<PerformanceMetrics> {
    // Force garbage collection if available
    if (typeof (window as any).gc === 'function') {
      (window as any).gc()
    }

    const startMemory = this.getMemoryUsage()
    const startTime = performance.now()

    // Run the function multiple times
    for (let i = 0; i < iterations; i++) {
      await fn()
    }

    const endTime = performance.now()
    const endMemory = this.getMemoryUsage()

    const executionTime = endTime - startTime
    const memoryUsage = Math.max(0, endMemory - startMemory)
    const operationsPerSecond = (iterations / executionTime) * 1000

    return {
      executionTime,
      memoryUsage,
      operationsPerSecond,
      timestamp: Date.now()
    }
  }

  private getMemoryUsage(): number {
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize || 0
    }
    return 0
  }

  getBenchmarkHistory(name: string): BenchmarkResult[] {
    return this.benchmarkHistory.get(name) || []
  }

  getAverageMetrics(name: string): BenchmarkResult | null {
    const history = this.getBenchmarkHistory(name)
    if (history.length === 0) return null

    const wasmMetrics = history
      .map(r => r.wasmMetrics)
      .filter(Boolean) as PerformanceMetrics[]

    const jsMetrics = history
      .map(r => r.jsMetrics)
      .filter(Boolean) as PerformanceMetrics[]

    const result: BenchmarkResult = {}

    if (wasmMetrics.length > 0) {
      result.wasmMetrics = {
        executionTime: wasmMetrics.reduce((sum, m) => sum + m.executionTime, 0) / wasmMetrics.length,
        memoryUsage: wasmMetrics.reduce((sum, m) => sum + m.memoryUsage, 0) / wasmMetrics.length,
        operationsPerSecond: wasmMetrics.reduce((sum, m) => sum + m.operationsPerSecond, 0) / wasmMetrics.length,
        timestamp: Date.now()
      }
    }

    if (jsMetrics.length > 0) {
      result.jsMetrics = {
        executionTime: jsMetrics.reduce((sum, m) => sum + m.executionTime, 0) / jsMetrics.length,
        memoryUsage: jsMetrics.reduce((sum, m) => sum + m.memoryUsage, 0) / jsMetrics.length,
        operationsPerSecond: jsMetrics.reduce((sum, m) => sum + m.operationsPerSecond, 0) / jsMetrics.length,
        timestamp: Date.now()
      }
    }

    if (result.wasmMetrics && result.jsMetrics) {
      result.speedupFactor = result.jsMetrics.executionTime / result.wasmMetrics.executionTime
      result.memoryEfficiency = result.jsMetrics.memoryUsage / result.wasmMetrics.memoryUsage
    }

    return result
  }

  clearHistory(name?: string): void {
    if (name) {
      this.benchmarkHistory.delete(name)
    } else {
      this.benchmarkHistory.clear()
    }
  }

  exportMetrics(): Record<string, BenchmarkResult[]> {
    const exported: Record<string, BenchmarkResult[]> = {}
    for (const [name, history] of this.benchmarkHistory) {
      exported[name] = [...history]
    }
    return exported
  }
}

// Singleton instance
export const wasmPerformanceMonitor = new WASMPerformanceMonitor()

// Utility functions for common benchmarks
export async function benchmarkImageProcessing(
  imageData: ImageData,
  wasmProcessor?: (data: ImageData) => Promise<ImageData>,
  jsProcessor?: (data: ImageData) => Promise<ImageData>
): Promise<BenchmarkResult> {
  return wasmPerformanceMonitor.benchmarkFunction(
    'image-processing',
    wasmProcessor ? () => wasmProcessor(imageData) : undefined,
    jsProcessor ? () => jsProcessor(imageData) : undefined,
    10 // Fewer iterations for image processing
  )
}

export async function benchmarkPhysicsSimulation(
  particleCount: number,
  wasmSimulator?: (count: number) => Promise<void>,
  jsSimulator?: (count: number) => Promise<void>
): Promise<BenchmarkResult> {
  return wasmPerformanceMonitor.benchmarkFunction(
    'physics-simulation',
    wasmSimulator ? () => wasmSimulator(particleCount) : undefined,
    jsSimulator ? () => jsSimulator(particleCount) : undefined,
    100
  )
}

export async function benchmarkCryptography(
  data: string,
  wasmHasher?: (data: string) => Promise<string>,
  jsHasher?: (data: string) => Promise<string>
): Promise<BenchmarkResult> {
  return wasmPerformanceMonitor.benchmarkFunction(
    'cryptography',
    wasmHasher ? () => wasmHasher(data) : undefined,
    jsHasher ? () => jsHasher(data) : undefined,
    1000
  )
}
