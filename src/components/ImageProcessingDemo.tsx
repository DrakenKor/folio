'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  loadWASMImageProcessor,
  type WASMImageProcessor
} from '@/lib/wasm-image-processor'

interface FilterConfig {
  name: string
  type: 'blur' | 'edge' | 'color' | 'brightness' | 'contrast' | 'sharpen'
  label: string
  hasParameter: boolean
  parameterLabel?: string
  parameterMin?: number
  parameterMax?: number
  parameterDefault?: number
  parameterStep?: number
  colorOptions?: string[]
}

const FILTERS: FilterConfig[] = [
  {
    name: 'blur',
    type: 'blur',
    label: 'Gaussian Blur',
    hasParameter: true,
    parameterLabel: 'Radius',
    parameterMin: 0.5,
    parameterMax: 10,
    parameterDefault: 2,
    parameterStep: 0.5
  },
  {
    name: 'edge',
    type: 'edge',
    label: 'Edge Detection',
    hasParameter: false
  },
  {
    name: 'sepia',
    type: 'color',
    label: 'Sepia',
    hasParameter: false
  },
  {
    name: 'grayscale',
    type: 'color',
    label: 'Grayscale',
    hasParameter: false
  },
  {
    name: 'invert',
    type: 'color',
    label: 'Invert Colors',
    hasParameter: false
  },
  {
    name: 'red',
    type: 'color',
    label: 'Red Channel',
    hasParameter: false
  },
  {
    name: 'green',
    type: 'color',
    label: 'Green Channel',
    hasParameter: false
  },
  {
    name: 'blue',
    type: 'color',
    label: 'Blue Channel',
    hasParameter: false
  },
  {
    name: 'brightness',
    type: 'brightness',
    label: 'Brightness',
    hasParameter: true,
    parameterLabel: 'Factor',
    parameterMin: 0.1,
    parameterMax: 3,
    parameterDefault: 1,
    parameterStep: 0.1
  },
  {
    name: 'contrast',
    type: 'contrast',
    label: 'Contrast',
    hasParameter: true,
    parameterLabel: 'Factor',
    parameterMin: -100,
    parameterMax: 100,
    parameterDefault: 0,
    parameterStep: 5
  },
  {
    name: 'sharpen',
    type: 'sharpen',
    label: 'Sharpen',
    hasParameter: true,
    parameterLabel: 'Strength',
    parameterMin: 0.1,
    parameterMax: 2,
    parameterDefault: 0.5,
    parameterStep: 0.1
  }
]

interface PerformanceMetrics {
  wasmTime: number
  jsTime: number
  speedup: number
  memoryUsage: number
}

export default function ImageProcessingDemo() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [wasmModule, setWasmModule] = useState<WASMImageProcessor | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [originalImageData, setOriginalImageData] = useState<ImageData | null>(
    null
  )
  const [currentImageData, setCurrentImageData] = useState<ImageData | null>(
    null
  )
  const [selectedFilter, setSelectedFilter] = useState<FilterConfig>(FILTERS[0])

  const [filterParameter, setFilterParameter] = useState<number>(
    FILTERS[0].parameterDefault || 1
  )
  const [isProcessing, setIsProcessing] = useState(false)
  const [performanceMetrics, setPerformanceMetrics] =
    useState<PerformanceMetrics | null>(null)
  const [showComparison, setShowComparison] = useState(false)

  // Initialize WASM module
  useEffect(() => {
    const initWASM = async () => {
      try {
        setIsLoading(true)

        const wasmProcessor = await loadWASMImageProcessor()
        setWasmModule(wasmProcessor)
        setError(null)
      } catch (err) {
        console.warn('WASM loading failed, using JavaScript fallback:', err)
        setWasmModule(null)
        setError(null)
      } finally {
        setIsLoading(false)
      }
    }

    initWASM()
  }, [])

  // Load default image
  useEffect(() => {
    const loadDefaultImage = () => {
      const canvas = canvasRef.current
      if (!canvas) return

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // Create a simple test pattern
      canvas.width = 400
      canvas.height = 300

      // Create gradient background
      const gradient = ctx.createLinearGradient(
        0,
        0,
        canvas.width,
        canvas.height
      )
      gradient.addColorStop(0, '#ff6b6b')
      gradient.addColorStop(0.5, '#4ecdc4')
      gradient.addColorStop(1, '#45b7d1')

      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Add some geometric shapes
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(50, 50, 100, 100)

      ctx.fillStyle = '#000000'
      ctx.beginPath()
      ctx.arc(300, 150, 50, 0, Math.PI * 2)
      ctx.fill()

      // Add text
      ctx.fillStyle = '#333333'
      ctx.font = '24px Arial'
      ctx.fillText('WASM Demo', 150, 200)

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      setOriginalImageData(imageData)
      setCurrentImageData(
        new ImageData(
          new Uint8ClampedArray(imageData.data),
          imageData.width,
          imageData.height
        )
      )
    }

    loadDefaultImage()
  }, [])

  const handleFileUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          const canvas = canvasRef.current
          if (!canvas) return

          const ctx = canvas.getContext('2d')
          if (!ctx) return

          // Resize canvas to fit image (max 800x600)
          const maxWidth = 800
          const maxHeight = 600
          let { width, height } = img

          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height)
            width *= ratio
            height *= ratio
          }

          canvas.width = width
          canvas.height = height
          ctx.drawImage(img, 0, 0, width, height)

          const imageData = ctx.getImageData(0, 0, width, height)
          setOriginalImageData(imageData)
          setCurrentImageData(
            new ImageData(
              new Uint8ClampedArray(imageData.data),
              imageData.width,
              imageData.height
            )
          )
        }
        img.src = e.target?.result as string
      }
      reader.readAsDataURL(file)
    },
    []
  )

  const applyFilterWASM = useCallback(
    async (
      imageData: ImageData,
      filter: FilterConfig,
      parameter: number
    ): Promise<{ processedData: ImageData; processingTime: number }> => {
      const startTime = performance.now()
      const data = new Uint8ClampedArray(imageData.data)

      if (wasmModule) {
        // Use WASM implementation
        switch (filter.type) {
          case 'blur':
            wasmModule.apply_blur(
              data,
              imageData.width,
              imageData.height,
              parameter
            )
            break
          case 'edge':
            wasmModule.apply_edge_detection(
              data,
              imageData.width,
              imageData.height
            )
            break
          case 'color':
            wasmModule.apply_color_filter(
              data,
              imageData.width,
              imageData.height,
              filter.name
            )
            break
          case 'brightness':
            wasmModule.adjust_brightness(
              data,
              imageData.width,
              imageData.height,
              parameter
            )
            break
          case 'contrast':
            wasmModule.adjust_contrast(
              data,
              imageData.width,
              imageData.height,
              parameter
            )
            break
          case 'sharpen':
            wasmModule.apply_sharpen(
              data,
              imageData.width,
              imageData.height,
              parameter
            )
            break
        }
      }

      const endTime = performance.now()
      const processingTime = endTime - startTime

      return {
        processedData: new ImageData(data, imageData.width, imageData.height),
        processingTime
      }
    },
    [wasmModule]
  )

  const applyFilterJS = useCallback(
    async (
      imageData: ImageData,
      filter: FilterConfig,
      parameter: number
    ): Promise<{ processedData: ImageData; processingTime: number }> => {
      const startTime = performance.now()
      const data = new Uint8ClampedArray(imageData.data)

      // Simple JavaScript implementations for comparison
      switch (filter.type) {
        case 'blur':
          // Simple box blur (much less efficient than Gaussian)
          for (let y = 1; y < imageData.height - 1; y++) {
            for (let x = 1; x < imageData.width - 1; x++) {
              for (let c = 0; c < 3; c++) {
                let sum = 0
                for (let dy = -1; dy <= 1; dy++) {
                  for (let dx = -1; dx <= 1; dx++) {
                    const idx = ((y + dy) * imageData.width + (x + dx)) * 4 + c
                    sum += data[idx]
                  }
                }
                const idx = (y * imageData.width + x) * 4 + c
                data[idx] = sum / 9
              }
            }
          }
          break
        case 'edge':
          // Simple edge detection
          for (let y = 1; y < imageData.height - 1; y++) {
            for (let x = 1; x < imageData.width - 1; x++) {
              const idx = (y * imageData.width + x) * 4
              const gray =
                0.299 * data[idx] +
                0.587 * data[idx + 1] +
                0.114 * data[idx + 2]
              data[idx] = data[idx + 1] = data[idx + 2] = gray > 128 ? 255 : 0
            }
          }
          break
        case 'color':
          for (let i = 0; i < data.length; i += 4) {
            if (filter.name === 'grayscale') {
              const gray =
                0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
              data[i] = data[i + 1] = data[i + 2] = gray
            } else if (filter.name === 'invert') {
              data[i] = 255 - data[i]
              data[i + 1] = 255 - data[i + 1]
              data[i + 2] = 255 - data[i + 2]
            }
          }
          break
        case 'brightness':
          for (let i = 0; i < data.length; i += 4) {
            data[i] = Math.min(255, Math.max(0, data[i] * parameter))
            data[i + 1] = Math.min(255, Math.max(0, data[i + 1] * parameter))
            data[i + 2] = Math.min(255, Math.max(0, data[i + 2] * parameter))
          }
          break
      }

      const endTime = performance.now()
      const processingTime = endTime - startTime

      return {
        processedData: new ImageData(data, imageData.width, imageData.height),
        processingTime
      }
    },
    []
  )

  const applyFilter = useCallback(async () => {
    if (!originalImageData) return

    setIsProcessing(true)
    setError(null)

    try {
      // Apply filter with WASM
      const wasmResult = await applyFilterWASM(
        originalImageData,
        selectedFilter,
        filterParameter
      )

      // Apply filter with JavaScript for comparison
      const jsResult = await applyFilterJS(
        originalImageData,
        selectedFilter,
        filterParameter
      )

      // Update canvas with WASM result
      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.putImageData(wasmResult.processedData, 0, 0)
        }
      }

      setCurrentImageData(wasmResult.processedData)

      // Calculate performance metrics
      const speedup = jsResult.processingTime / wasmResult.processingTime
      const memoryUsage = wasmModule ? wasmModule.get_memory_usage() : 0

      setPerformanceMetrics({
        wasmTime: wasmResult.processingTime,
        jsTime: jsResult.processingTime,
        speedup,
        memoryUsage
      })
    } catch (err) {
      setError(
        `Filter processing failed: ${
          err instanceof Error ? err.message : 'Unknown error'
        }`
      )
      console.error('Filter processing error:', err)
    } finally {
      setIsProcessing(false)
    }
  }, [
    originalImageData,
    wasmModule,
    selectedFilter,
    filterParameter,
    applyFilterWASM,
    applyFilterJS
  ])

  // Auto-apply filter when selection or parameter changes
  useEffect(() => {
    if (originalImageData && !isProcessing) {
      const timeoutId = setTimeout(() => {
        applyFilter()
      }, 300) // Debounce for 300ms to avoid too many calls during parameter adjustment

      return () => clearTimeout(timeoutId)
    }
  }, [
    selectedFilter,
    filterParameter,
    originalImageData,
    applyFilter,
    isProcessing
  ])

  const resetImage = useCallback(() => {
    if (!originalImageData) return

    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.putImageData(originalImageData, 0, 0)
      }
    }

    setCurrentImageData(
      new ImageData(
        new Uint8ClampedArray(originalImageData.data),
        originalImageData.width,
        originalImageData.height
      )
    )
    setPerformanceMetrics(null)
  }, [originalImageData])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">
            Loading WASM Image Processing Module...
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 className="text-red-800 font-semibold mb-2">Error</h3>
        <p className="text-red-600">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-4">WASM Image Processing Demo</h2>
        <p className="text-gray-600 mb-6">
          Real-time image processing powered by WebAssembly. Upload an image or
          use the default test pattern to see WASM performance compared to
          JavaScript implementations.
        </p>

        {/* File Upload */}
        <div className="mb-6">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors">
            Upload Image
          </button>
        </div>

        {/* Canvas */}
        <div className="mb-6 flex justify-center">
          <canvas
            ref={canvasRef}
            className="border border-gray-300 rounded-lg shadow-sm max-w-full"
            style={{ maxHeight: '400px' }}
          />
        </div>

        {/* Debug Info */}
        <div className="mb-4 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm">
          <strong>Debug:</strong> Selected filter:{' '}
          {selectedFilter?.name || 'none'} ({selectedFilter?.label || 'none'})
        </div>

        {/* Filter Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Filter
            </label>
            <select
              value={selectedFilter.name}
              onChange={(e) => {
                const filter = FILTERS.find((f) => f.name === e.target.value)
                if (filter) {
                  setSelectedFilter(filter)
                  setFilterParameter(filter.parameterDefault || 1)
                }
              }}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
              {FILTERS.map((filter) => (
                <option key={filter.name} value={filter.name}>
                  {filter.label}
                </option>
              ))}
            </select>
          </div>

          {selectedFilter.hasParameter && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {selectedFilter.parameterLabel} ({filterParameter})
              </label>
              <input
                type="range"
                min={selectedFilter.parameterMin}
                max={selectedFilter.parameterMax}
                step={selectedFilter.parameterStep}
                value={filterParameter}
                onChange={(e) => setFilterParameter(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 mb-6">
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              {isProcessing ? 'Processing...' : 'Filters apply automatically'}
              {wasmModule ? ' (WASM)' : ' (JS Fallback)'}
            </span>
            <button
              onClick={applyFilter}
              disabled={isProcessing}
              className="bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition-colors text-sm">
              Reapply
            </button>
          </div>
          <button
            onClick={resetImage}
            disabled={isProcessing}
            className="bg-gray-500 hover:bg-gray-600 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg transition-colors">
            Reset
          </button>
        </div>

        {/* Performance Metrics */}
        {performanceMetrics && (
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold mb-3">Performance Comparison</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-gray-600">WASM Time</div>
                <div className="font-mono">
                  {performanceMetrics.wasmTime.toFixed(2)}ms
                </div>
              </div>
              <div>
                <div className="text-gray-600">JS Time</div>
                <div className="font-mono">
                  {performanceMetrics.jsTime.toFixed(2)}ms
                </div>
              </div>
              <div>
                <div className="text-gray-600">Speedup</div>
                <div className="font-mono text-green-600">
                  {performanceMetrics.speedup.toFixed(1)}x
                </div>
              </div>
              <div>
                <div className="text-gray-600">Memory</div>
                <div className="font-mono">
                  {(performanceMetrics.memoryUsage / 1024).toFixed(1)}KB
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
