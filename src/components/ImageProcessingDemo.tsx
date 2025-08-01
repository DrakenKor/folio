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
  const wasmCanvasRef = useRef<HTMLCanvasElement>(null)
  const jsCanvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [wasmModule, setWasmModule] = useState<WASMImageProcessor | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [originalImageData, setOriginalImageData] = useState<ImageData | null>(
    null
  )
  const [wasmImageData, setWasmImageData] = useState<ImageData | null>(null)
  const [jsImageData, setJsImageData] = useState<ImageData | null>(null)
  const [selectedFilter, setSelectedFilter] = useState<FilterConfig>(FILTERS[0])

  const [filterParameter, setFilterParameter] = useState<number>(
    FILTERS[0].parameterDefault || 1
  )
  const [isProcessing, setIsProcessing] = useState(false)
  const [performanceMetrics, setPerformanceMetrics] =
    useState<PerformanceMetrics | null>(null)

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
      const wasmCanvas = wasmCanvasRef.current
      const jsCanvas = jsCanvasRef.current
      if (!wasmCanvas || !jsCanvas) return

      const wasmCtx = wasmCanvas.getContext('2d')
      const jsCtx = jsCanvas.getContext('2d')
      if (!wasmCtx || !jsCtx) return

      // Create a simple test pattern
      const width = 400
      const height = 300
      wasmCanvas.width = width
      wasmCanvas.height = height
      jsCanvas.width = width
      jsCanvas.height = height

      // Create gradient background
      const gradient = wasmCtx.createLinearGradient(0, 0, width, height)
      gradient.addColorStop(0, '#ff6b6b')
      gradient.addColorStop(0.5, '#4ecdc4')
      gradient.addColorStop(1, '#45b7d1')

      wasmCtx.fillStyle = gradient
      wasmCtx.fillRect(0, 0, width, height)

      // Add some geometric shapes
      wasmCtx.fillStyle = '#ffffff'
      wasmCtx.fillRect(50, 50, 100, 100)

      wasmCtx.fillStyle = '#000000'
      wasmCtx.beginPath()
      wasmCtx.arc(300, 150, 50, 0, Math.PI * 2)
      wasmCtx.fill()

      // Add text
      wasmCtx.fillStyle = '#333333'
      wasmCtx.font = '24px Arial'
      wasmCtx.fillText('WASM Demo', 150, 200)

      // Copy to JS canvas
      jsCtx.drawImage(wasmCanvas, 0, 0)

      const imageData = wasmCtx.getImageData(0, 0, width, height)
      setOriginalImageData(imageData)
      setWasmImageData(
        new ImageData(
          new Uint8ClampedArray(imageData.data),
          imageData.width,
          imageData.height
        )
      )
      setJsImageData(
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
          const wasmCanvas = wasmCanvasRef.current
          const jsCanvas = jsCanvasRef.current
          if (!wasmCanvas || !jsCanvas) return

          const wasmCtx = wasmCanvas.getContext('2d')
          const jsCtx = jsCanvas.getContext('2d')
          if (!wasmCtx || !jsCtx) return

          // Resize canvas to fit image (max 400x300 for side-by-side display)
          const maxWidth = 400
          const maxHeight = 300
          let { width, height } = img

          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height)
            width *= ratio
            height *= ratio
          }

          wasmCanvas.width = width
          wasmCanvas.height = height
          jsCanvas.width = width
          jsCanvas.height = height

          wasmCtx.drawImage(img, 0, 0, width, height)
          jsCtx.drawImage(img, 0, 0, width, height)

          const imageData = wasmCtx.getImageData(0, 0, width, height)
          setOriginalImageData(imageData)
          setWasmImageData(
            new ImageData(
              new Uint8ClampedArray(imageData.data),
              imageData.width,
              imageData.height
            )
          )
          setJsImageData(
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
          // Simple box blur with parameter support
          const radius = Math.max(1, Math.floor(parameter))
          for (let y = radius; y < imageData.height - radius; y++) {
            for (let x = radius; x < imageData.width - radius; x++) {
              for (let c = 0; c < 3; c++) {
                let sum = 0
                let count = 0
                for (let dy = -radius; dy <= radius; dy++) {
                  for (let dx = -radius; dx <= radius; dx++) {
                    const idx = ((y + dy) * imageData.width + (x + dx)) * 4 + c
                    sum += data[idx]
                    count++
                  }
                }
                const idx = (y * imageData.width + x) * 4 + c
                data[idx] = sum / count
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
            } else if (filter.name === 'sepia') {
              const r = data[i]
              const g = data[i + 1]
              const b = data[i + 2]
              data[i] = Math.min(255, r * 0.393 + g * 0.769 + b * 0.189)
              data[i + 1] = Math.min(255, r * 0.349 + g * 0.686 + b * 0.168)
              data[i + 2] = Math.min(255, r * 0.272 + g * 0.534 + b * 0.131)
            } else if (filter.name === 'red') {
              data[i + 1] = 0 // Remove green
              data[i + 2] = 0 // Remove blue
            } else if (filter.name === 'green') {
              data[i] = 0 // Remove red
              data[i + 2] = 0 // Remove blue
            } else if (filter.name === 'blue') {
              data[i] = 0 // Remove red
              data[i + 1] = 0 // Remove green
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
        case 'contrast':
          // Contrast adjustment: factor = (259 * (contrast + 255)) / (255 * (259 - contrast))
          const factor = (259 * (parameter + 255)) / (255 * (259 - parameter))
          for (let i = 0; i < data.length; i += 4) {
            data[i] = Math.min(255, Math.max(0, factor * (data[i] - 128) + 128))
            data[i + 1] = Math.min(
              255,
              Math.max(0, factor * (data[i + 1] - 128) + 128)
            )
            data[i + 2] = Math.min(
              255,
              Math.max(0, factor * (data[i + 2] - 128) + 128)
            )
          }
          break
        case 'sharpen':
          // Simple unsharp mask approximation
          const strength = parameter
          const tempData = new Uint8ClampedArray(data)
          for (let y = 1; y < imageData.height - 1; y++) {
            for (let x = 1; x < imageData.width - 1; x++) {
              for (let c = 0; c < 3; c++) {
                const idx = (y * imageData.width + x) * 4 + c
                const original = tempData[idx]

                // Calculate blur value (simple 3x3 average)
                let blur = 0
                for (let dy = -1; dy <= 1; dy++) {
                  for (let dx = -1; dx <= 1; dx++) {
                    blur +=
                      tempData[((y + dy) * imageData.width + (x + dx)) * 4 + c]
                  }
                }
                blur /= 9

                // Apply unsharp mask: original + strength * (original - blur)
                const sharpened = original + strength * (original - blur)
                data[idx] = Math.min(255, Math.max(0, sharpened))
              }
            }
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

      // Update canvases with both results
      const wasmCanvas = wasmCanvasRef.current
      const jsCanvas = jsCanvasRef.current
      if (wasmCanvas && jsCanvas) {
        const wasmCtx = wasmCanvas.getContext('2d')
        const jsCtx = jsCanvas.getContext('2d')
        if (wasmCtx && jsCtx) {
          wasmCtx.putImageData(wasmResult.processedData, 0, 0)
          jsCtx.putImageData(jsResult.processedData, 0, 0)
        }
      }

      setWasmImageData(wasmResult.processedData)
      setJsImageData(jsResult.processedData)

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

    const wasmCanvas = wasmCanvasRef.current
    const jsCanvas = jsCanvasRef.current
    if (wasmCanvas && jsCanvas) {
      const wasmCtx = wasmCanvas.getContext('2d')
      const jsCtx = jsCanvas.getContext('2d')
      if (wasmCtx && jsCtx) {
        wasmCtx.putImageData(originalImageData, 0, 0)
        jsCtx.putImageData(originalImageData, 0, 0)
      }
    }

    setWasmImageData(
      new ImageData(
        new Uint8ClampedArray(originalImageData.data),
        originalImageData.width,
        originalImageData.height
      )
    )
    setJsImageData(
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
      <div className="bg-gray-800 rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-4 text-white">
          WASM Image Processing Demo
        </h2>
        <p className="text-gray-300 mb-6">
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

        {/* Side-by-side Canvas Comparison */}
        <div className="mb-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-white mb-3">
                Rust WASM
              </h3>
              <canvas
                ref={wasmCanvasRef}
                className="border border-gray-300 rounded-lg shadow-sm max-w-full mx-auto"
                style={{ maxHeight: '300px' }}
              />
              <p className="text-sm text-gray-400 mt-2">
                High-performance Rust implementation compiled to WebAssembly
              </p>
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold text-white mb-3">
                JavaScript
              </h3>
              <canvas
                ref={jsCanvasRef}
                className="border border-gray-300 rounded-lg shadow-sm max-w-full mx-auto"
                style={{ maxHeight: '300px' }}
              />
              <p className="text-sm text-gray-400 mt-2">
                Native JavaScript implementation for comparison
              </p>
            </div>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-200 mb-2">
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
              className="w-full p-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
              {FILTERS.map((filter) => (
                <option key={filter.name} value={filter.name}>
                  {filter.label}
                </option>
              ))}
            </select>
          </div>

          {selectedFilter.hasParameter && (
            <div>
              <label className="block text-sm font-medium text-gray-200 mb-2">
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
            <span className="text-sm text-gray-300">
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
          <div className="bg-gray-700 rounded-lg p-4">
            <h3 className="font-semibold mb-3 text-white">
              Performance Comparison
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-gray-300">WASM Time</div>
                <div className="font-mono text-white">
                  {performanceMetrics.wasmTime.toFixed(2)}ms
                </div>
              </div>
              <div>
                <div className="text-gray-300">JS Time</div>
                <div className="font-mono text-white">
                  {performanceMetrics.jsTime.toFixed(2)}ms
                </div>
              </div>
              <div>
                <div className="text-gray-300">Speedup</div>
                <div className="font-mono text-green-400">
                  {performanceMetrics.speedup.toFixed(1)}x
                </div>
              </div>
              <div>
                <div className="text-gray-300">Memory</div>
                <div className="font-mono text-white">
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
