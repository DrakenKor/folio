'use client'

import React, { useState, useEffect } from 'react'
import { initializeWASMCore, getWASMCore, type WASMCoreInterface } from '../../lib/wasm-core-loader'
import { wasmPerformanceMonitor, type BenchmarkResult } from '../../lib/wasm-performance-monitor'
import { isWASMAvailable } from '../../lib/wasm-loader'

interface DemoState {
  wasmCore: WASMCoreInterface | null
  loading: boolean
  error: string | null
  testResults: Array<{ test: string; result: string; success: boolean }>
  performanceResults: Record<string, BenchmarkResult> | null
}

export default function WASMDemoPage() {
  const [state, setState] = useState<DemoState>({
    wasmCore: null,
    loading: true,
    error: null,
    testResults: [],
    performanceResults: null
  })

  useEffect(() => {
    initializeWASM()
  }, [])

  const initializeWASM = async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }))

      if (!isWASMAvailable()) {
        throw new Error('WASM is not supported in this browser')
      }

      console.log('🚀 Initializing WASM core...')
      const wasmCore = await initializeWASMCore()

      if (!wasmCore) {
        throw new Error('WASM core module failed to initialize')
      }

      setState(prev => ({
        ...prev,
        wasmCore,
        loading: false,
        error: null
      }))

      console.log('✅ WASM core initialized successfully')
    } catch (err) {
      console.error('❌ WASM initialization failed:', err)
      setState(prev => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Unknown error'
      }))
    }
  }

  const runBasicTests = async () => {
    if (!state.wasmCore) return

    const results: Array<{ test: string; result: string; success: boolean }> = []

    try {
      // Test greeting function
      const greeting = state.wasmCore.greet('Portfolio Visitor')
      results.push({ test: 'Greeting', result: greeting, success: true })

      // Test performance
      const perfTime = state.wasmCore.performanceTest(10000)
      results.push({ test: 'Performance Test', result: `${perfTime.toFixed(2)}ms`, success: true })

      // Test fibonacci
      const fib = state.wasmCore.fibonacci(20)
      results.push({ test: 'Fibonacci(20)', result: fib.toString(), success: true })

      // Test prime sieve
      const primes = state.wasmCore.primeSieve(50)
      results.push({ test: 'Primes up to 50', result: `${primes.length} primes found`, success: true })

      // Test memory usage
      const memory = state.wasmCore.getMemoryUsage()
      results.push({ test: 'Memory Usage', result: `${memory} bytes`, success: true })

      // Test array operations
      const testArray = new Float64Array([1, 2, 3, 4, 5])
      const sum = state.wasmCore.sumArray(testArray)
      results.push({ test: 'Array Sum [1,2,3,4,5]', result: sum.toString(), success: true })

      // Test string operations
      const reversed = state.wasmCore.reverseString('WebAssembly')
      results.push({ test: 'Reverse "WebAssembly"', result: reversed, success: true })

      const wordCount = state.wasmCore.countWords('Hello WASM World from Rust')
      results.push({ test: 'Word Count', result: wordCount.toString(), success: true })

    } catch (err) {
      results.push({
        test: 'Error',
        result: err instanceof Error ? err.message : 'Unknown error',
        success: false
      })
    }

    setState(prev => ({ ...prev, testResults: results }))
  }

  const runPerformanceBenchmark = async () => {
    if (!state.wasmCore) return

    // JavaScript implementations for comparison
    const jsFibonacci = (n: number): bigint => {
      if (n <= 1) return BigInt(n)
      let a = 0n, b = 1n
      for (let i = 2; i <= n; i++) {
        [a, b] = [b, a + b]
      }
      return b
    }

    const jsPrimeSieve = (limit: number): Uint32Array => {
      if (limit < 2) return new Uint32Array(0)
      const sieve = new Array(limit + 1).fill(true)
      sieve[0] = sieve[1] = false

      for (let p = 2; p * p <= limit; p++) {
        if (sieve[p]) {
          for (let i = p * p; i <= limit; i += p) {
            sieve[i] = false
          }
        }
      }

      const primes = []
      for (let i = 2; i <= limit; i++) {
        if (sieve[i]) primes.push(i)
      }
      return new Uint32Array(primes)
    }

    try {
      console.log('🏃 Running performance benchmarks...')

      // Benchmark fibonacci calculation
      const fibResult = await wasmPerformanceMonitor.benchmarkFunction(
        'fibonacci',
        () => state.wasmCore!.fibonacci(35),
        () => jsFibonacci(35),
        5
      )

      // Benchmark prime sieve
      const primeResult = await wasmPerformanceMonitor.benchmarkFunction(
        'prime-sieve',
        () => state.wasmCore!.primeSieve(10000),
        () => jsPrimeSieve(10000),
        5
      )

      // Benchmark array operations
      const arrayResult = await wasmPerformanceMonitor.benchmarkFunction(
        'array-sum',
        () => {
          const arr = new Float64Array(10000)
          for (let i = 0; i < arr.length; i++) arr[i] = Math.random()
          return state.wasmCore!.sumArray(arr)
        },
        () => {
          const arr = new Float64Array(10000)
          for (let i = 0; i < arr.length; i++) arr[i] = Math.random()
          return arr.reduce((sum, val) => sum + val, 0)
        },
        10
      )

      setState(prev => ({
        ...prev,
        performanceResults: {
          fibonacci: fibResult,
          primeSieve: primeResult,
          arraySum: arrayResult
        }
      }))

      console.log('✅ Performance benchmarks completed')
    } catch (err) {
      console.error('❌ Performance benchmark failed:', err)
    }
  }

  if (state.loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Initializing WASM...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-center">WASM Demo</h1>

        {state.error && (
          <div className="bg-red-900 border border-red-500 rounded p-4 mb-6">
            <h2 className="text-xl font-semibold mb-2">Error</h2>
            <p>{state.error}</p>
            {state.error.includes('not built yet') && (
              <div className="mt-4 p-3 bg-gray-800 rounded">
                <p className="text-sm">To build the WASM module, run:</p>
                <code className="block mt-2 p-2 bg-black rounded text-green-400">
                  cd wasm && ./build.sh
                </code>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* WASM Status */}
          <div className="bg-gray-900 rounded-lg p-6">
            <h2 className="text-2xl font-semibold mb-4">WASM Status</h2>
            <div className="space-y-2">
              <p>
                <span className="font-medium">WASM Support:</span>{' '}
                <span className={isWASMAvailable() ? 'text-green-400' : 'text-red-400'}>
                  {isWASMAvailable() ? 'Available' : 'Not Available'}
                </span>
              </p>
              <p>
                <span className="font-medium">Core Module:</span>{' '}
                <span className={state.wasmCore ? 'text-green-400' : 'text-red-400'}>
                  {state.wasmCore ? 'Loaded' : 'Not Loaded'}
                </span>
              </p>
              {state.wasmCore && (
                <p>
                  <span className="font-medium">Memory Usage:</span>{' '}
                  <span className="text-blue-400">{state.wasmCore.getMemoryUsage()} bytes</span>
                </p>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="bg-gray-900 rounded-lg p-6">
            <h2 className="text-2xl font-semibold mb-4">Controls</h2>
            <div className="space-y-3">
              <button
                onClick={runBasicTests}
                disabled={!state.wasmCore}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-4 py-2 rounded transition-colors"
              >
                Run Basic Tests
              </button>
              <button
                onClick={runPerformanceBenchmark}
                disabled={!state.wasmCore}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-4 py-2 rounded transition-colors"
              >
                Run Performance Benchmark
              </button>
              <button
                onClick={initializeWASM}
                className="w-full bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded transition-colors"
              >
                Reinitialize WASM
              </button>
            </div>
          </div>
        </div>

        {/* Test Results */}
        {state.testResults.length > 0 && (
          <div className="mt-8 bg-gray-900 rounded-lg p-6">
            <h2 className="text-2xl font-semibold mb-4">Test Results</h2>
            <div className="space-y-2">
              {state.testResults.map((result, index) => (
                <div key={index} className="flex justify-between items-center p-2 bg-gray-800 rounded">
                  <span className="font-medium">{result.test}:</span>
                  <span className={result.success ? 'text-green-400' : 'text-red-400'}>
                    {result.result}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Performance Results */}
        {state.performanceResults && (
          <div className="mt-8 bg-gray-900 rounded-lg p-6">
            <h2 className="text-2xl font-semibold mb-4">Performance Comparison</h2>
            <div className="space-y-4">
              {Object.entries(state.performanceResults).map(([test, result]: [string, BenchmarkResult]) => (
                <div key={test} className="p-4 bg-gray-800 rounded">
                  <h3 className="text-lg font-medium mb-2 capitalize">{test.replace('-', ' ')}</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {result.wasmMetrics && (
                      <div>
                        <p className="text-blue-400 font-medium">WASM</p>
                        <p>Time: {result.wasmMetrics.executionTime.toFixed(2)}ms</p>
                        <p>Ops/sec: {result.wasmMetrics.operationsPerSecond.toFixed(0)}</p>
                      </div>
                    )}
                    {result.jsMetrics && (
                      <div>
                        <p className="text-yellow-400 font-medium">JavaScript</p>
                        <p>Time: {result.jsMetrics.executionTime.toFixed(2)}ms</p>
                        <p>Ops/sec: {result.jsMetrics.operationsPerSecond.toFixed(0)}</p>
                      </div>
                    )}
                  </div>
                  {result.speedupFactor && (
                    <p className="mt-2 text-green-400">
                      Speedup: {result.speedupFactor.toFixed(2)}x
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="mt-8 bg-gray-900 rounded-lg p-6">
          <h2 className="text-2xl font-semibold mb-4">Build Instructions</h2>
          <div className="space-y-3 text-sm">
            <p>To build and test the WASM modules:</p>
            <ol className="list-decimal list-inside space-y-1 ml-4">
              <li>Install Rust and wasm-pack if not already installed</li>
              <li>Navigate to the wasm directory: <code className="bg-black px-2 py-1 rounded">cd wasm</code></li>
              <li>Run the build script: <code className="bg-black px-2 py-1 rounded">./build.sh</code></li>
              <li>Refresh this page to test the compiled modules</li>
            </ol>
            <div className="mt-4 p-3 bg-gray-800 rounded">
              <p className="font-medium">Install wasm-pack:</p>
              <code className="block mt-1 text-green-400">
                curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
              </code>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
