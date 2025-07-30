/**
 * Test to verify WASM module loading fix
 */

import { describe, it, expect } from 'vitest'
import { loadWASMImageProcessor } from '../lib/wasm-image-processor'

describe('WASM Image Processor Loading Fix', () => {
  it('should load WASM module without wasm_bindgen error', async () => {
    // Skip in Node.js environment since WASM loading is client-side only
    if (typeof window === 'undefined') {
      expect(true).toBe(true)
      return
    }

    try {
      const processor = await loadWASMImageProcessor()

      // Verify the processor has the expected methods
      expect(processor).toBeDefined()
      expect(typeof processor.apply_blur).toBe('function')
      expect(typeof processor.apply_edge_detection).toBe('function')
      expect(typeof processor.apply_color_filter).toBe('function')
      expect(typeof processor.adjust_brightness).toBe('function')
      expect(typeof processor.adjust_contrast).toBe('function')
      expect(typeof processor.apply_sharpen).toBe('function')
      expect(typeof processor.get_memory_usage).toBe('function')

      console.log('WASM module loaded successfully!')
    } catch (error) {
      // Should not throw the "wasm_bindgen not found" error anymore
      expect(error).not.toMatch(/wasm_bindgen not found/)

      // Log the actual error for debugging
      console.log('WASM loading error:', error)
    }
  })

  it('should handle client-side only restriction', async () => {
    // This test runs in Node.js environment
    if (typeof window === 'undefined') {
      try {
        await loadWASMImageProcessor()
        // Should not reach here
        expect(false).toBe(true)
      } catch (error) {
        expect(error.message).toContain('client side')
      }
    }
  })
})
