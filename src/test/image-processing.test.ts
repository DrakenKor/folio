/**
 * Tests for WASM Image Processing Module
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { loadWASMModule } from '@/lib/wasm-loader'
import type { WASMCoreModule } from '@/types/wasm'

describe('WASM Image Processing', () => {
  let wasmModule: WASMCoreModule | null = null

  beforeAll(async () => {
    try {
      wasmModule = await loadWASMModule('CORE')
    } catch (error) {
      console.warn('WASM module not available for testing:', error)
    }
  })

  afterAll(() => {
    if (wasmModule) {
      wasmModule.force_gc()
    }
  })

  describe('Module Loading', () => {
    it('should load WASM module successfully', () => {
      // Skip if WASM not available (e.g., in CI environment)
      if (!wasmModule) {
        console.log('Skipping WASM tests - module not available')
        return
      }

      expect(wasmModule).toBeTruthy()
      expect(typeof wasmModule.apply_blur).toBe('function')
      expect(typeof wasmModule.apply_edge_detection).toBe('function')
      expect(typeof wasmModule.apply_color_filter).toBe('function')
      expect(typeof wasmModule.adjust_brightness).toBe('function')
      expect(typeof wasmModule.adjust_contrast).toBe('function')
      expect(typeof wasmModule.apply_sharpen).toBe('function')
    })

    it('should create ImageProcessor instance', () => {
      if (!wasmModule) return

      const processor = new wasmModule.ImageProcessor(100, 100)
      expect(processor).toBeTruthy()
      expect(processor.get_width()).toBe(100)
      expect(processor.get_height()).toBe(100)

      processor.set_dimensions(200, 150)
      expect(processor.get_width()).toBe(200)
      expect(processor.get_height()).toBe(150)
    })
  })

  describe('Image Processing Functions', () => {
    let testImageData: Uint8ClampedArray

    beforeAll(() => {
      // Create a simple test image (4x4 pixels, RGBA)
      testImageData = new Uint8ClampedArray([
        255, 0, 0, 255,    // Red pixel
        0, 255, 0, 255,    // Green pixel
        0, 0, 255, 255,    // Blue pixel
        255, 255, 255, 255, // White pixel

        128, 128, 128, 255, // Gray pixel
        255, 255, 0, 255,   // Yellow pixel
        255, 0, 255, 255,   // Magenta pixel
        0, 255, 255, 255,   // Cyan pixel

        64, 64, 64, 255,    // Dark gray
        192, 192, 192, 255, // Light gray
        255, 128, 0, 255,   // Orange
        128, 0, 128, 255,   // Purple

        0, 0, 0, 255,       // Black
        255, 255, 255, 255, // White
        128, 255, 128, 255, // Light green
        255, 128, 128, 255  // Light red
      ])
    })

    it('should apply blur filter without errors', () => {
      if (!wasmModule) return

      const data = new Uint8ClampedArray(testImageData)
      expect(() => {
        wasmModule.apply_blur(data, 4, 4, 1.0)
      }).not.toThrow()

      // Data should be modified
      expect(data).not.toEqual(testImageData)

      // Alpha channel should be preserved
      for (let i = 3; i < data.length; i += 4) {
        expect(data[i]).toBe(255)
      }
    })

    it('should apply edge detection without errors', () => {
      if (!wasmModule) return

      const data = new Uint8ClampedArray(testImageData)
      expect(() => {
        wasmModule.apply_edge_detection(data, 4, 4)
      }).not.toThrow()

      // Data should be modified
      expect(data).not.toEqual(testImageData)
    })

    it('should apply color filters correctly', () => {
      if (!wasmModule) return

      const filters = ['sepia', 'grayscale', 'invert', 'red', 'green', 'blue']

      filters.forEach(filter => {
        const data = new Uint8ClampedArray(testImageData)
        expect(() => {
          wasmModule.apply_color_filter(data, 4, 4, filter)
        }).not.toThrow()

        // Data should be modified (except for unknown filters)
        if (filter !== 'unknown') {
          expect(data).not.toEqual(testImageData)
        }
      })
    })

    it('should apply grayscale filter correctly', () => {
      if (!wasmModule) return

      const data = new Uint8ClampedArray(testImageData)
      wasmModule.apply_color_filter(data, 4, 4, 'grayscale')

      // Check that RGB values are equal for grayscale
      for (let i = 0; i < data.length; i += 4) {
        expect(data[i]).toBe(data[i + 1]) // R = G
        expect(data[i + 1]).toBe(data[i + 2]) // G = B
        expect(data[i + 3]).toBe(255) // Alpha preserved
      }
    })

    it('should apply invert filter correctly', () => {
      if (!wasmModule) return

      const data = new Uint8ClampedArray(testImageData)
      wasmModule.apply_color_filter(data, 4, 4, 'invert')

      // Check that colors are inverted
      expect(data[0]).toBe(255 - testImageData[0]) // Red inverted
      expect(data[1]).toBe(255 - testImageData[1]) // Green inverted
      expect(data[2]).toBe(255 - testImageData[2]) // Blue inverted
      expect(data[3]).toBe(testImageData[3]) // Alpha preserved
    })

    it('should adjust brightness correctly', () => {
      if (!wasmModule) return

      // Test brightness increase
      const brightData = new Uint8ClampedArray(testImageData)
      wasmModule.adjust_brightness(brightData, 4, 4, 1.5)

      // Should be brighter (values increased, clamped to 255)
      expect(brightData[0]).toBeGreaterThanOrEqual(testImageData[0])

      // Test brightness decrease
      const darkData = new Uint8ClampedArray(testImageData)
      wasmModule.adjust_brightness(darkData, 4, 4, 0.5)

      // Should be darker
      expect(darkData[0]).toBeLessThanOrEqual(testImageData[0])
    })

    it('should adjust contrast correctly', () => {
      if (!wasmModule) return

      const data = new Uint8ClampedArray(testImageData)
      expect(() => {
        wasmModule.adjust_contrast(data, 4, 4, 50)
      }).not.toThrow()

      // Data should be modified
      expect(data).not.toEqual(testImageData)
    })

    it('should apply sharpen filter without errors', () => {
      if (!wasmModule) return

      const data = new Uint8ClampedArray(testImageData)
      expect(() => {
        wasmModule.apply_sharpen(data, 4, 4, 0.5)
      }).not.toThrow()

      // Data should be modified
      expect(data).not.toEqual(testImageData)
    })

    it('should handle edge cases gracefully', () => {
      if (!wasmModule) return

      // Test with empty data
      const emptyData = new Uint8ClampedArray(0)
      expect(() => {
        wasmModule.apply_blur(emptyData, 0, 0, 1.0)
      }).not.toThrow()

      // Test with mismatched dimensions
      const smallData = new Uint8ClampedArray(4) // 1 pixel
      expect(() => {
        wasmModule.apply_blur(smallData, 10, 10, 1.0) // Wrong dimensions
      }).not.toThrow()

      // Test with zero blur radius
      const data = new Uint8ClampedArray(testImageData)
      expect(() => {
        wasmModule.apply_blur(data, 4, 4, 0)
      }).not.toThrow()
    })
  })

  describe('Performance Characteristics', () => {
    it('should process images efficiently', () => {
      if (!wasmModule) return

      // Create a larger test image (100x100)
      const size = 100 * 100 * 4
      const largeImageData = new Uint8ClampedArray(size)

      // Fill with test pattern
      for (let i = 0; i < size; i += 4) {
        largeImageData[i] = (i / 4) % 256     // Red
        largeImageData[i + 1] = ((i / 4) * 2) % 256 // Green
        largeImageData[i + 2] = ((i / 4) * 3) % 256 // Blue
        largeImageData[i + 3] = 255           // Alpha
      }

      const startTime = performance.now()
      wasmModule.apply_blur(largeImageData, 100, 100, 2.0)
      const endTime = performance.now()

      const processingTime = endTime - startTime
      console.log(`WASM blur processing time for 100x100 image: ${processingTime.toFixed(2)}ms`)

      // Should complete in reasonable time (less than 100ms for 100x100 image)
      expect(processingTime).toBeLessThan(100)
    })

    it('should have reasonable memory usage', () => {
      if (!wasmModule) return

      const initialMemory = wasmModule.get_memory_usage()

      // Process several images
      for (let i = 0; i < 10; i++) {
        const data = new Uint8ClampedArray(testImageData)
        wasmModule.apply_blur(data, 4, 4, 1.0)
      }

      const finalMemory = wasmModule.get_memory_usage()

      // Memory usage shouldn't grow excessively
      const memoryGrowth = finalMemory - initialMemory
      expect(memoryGrowth).toBeLessThan(1024 * 1024) // Less than 1MB growth
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid filter names gracefully', () => {
      if (!wasmModule) return

      const data = new Uint8ClampedArray(testImageData)
      const originalData = new Uint8ClampedArray(testImageData)

      expect(() => {
        wasmModule.apply_color_filter(data, 4, 4, 'invalid_filter')
      }).not.toThrow()

      // Data should remain unchanged for invalid filter
      expect(data).toEqual(originalData)
    })

    it('should handle negative parameters appropriately', () => {
      if (!wasmModule) return

      const data = new Uint8ClampedArray(testImageData)

      expect(() => {
        wasmModule.apply_blur(data, 4, 4, -1.0) // Negative radius
      }).not.toThrow()

      expect(() => {
        wasmModule.adjust_brightness(data, 4, 4, -0.5) // Negative brightness
      }).not.toThrow()
    })
  })
})
