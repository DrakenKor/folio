/**
 * Direct WASM Image Processor
 * Loads WASM module directly without complex module loader
 */

export interface WASMImageProcessor {
  apply_blur(data: Uint8ClampedArray, width: number, height: number, radius: number): void
  apply_edge_detection(data: Uint8ClampedArray, width: number, height: number): void
  apply_color_filter(data: Uint8ClampedArray, width: number, height: number, filter: string): void
  adjust_brightness(data: Uint8ClampedArray, width: number, height: number, factor: number): void
  adjust_contrast(data: Uint8ClampedArray, width: number, height: number, factor: number): void
  apply_sharpen(data: Uint8ClampedArray, width: number, height: number, strength: number): void
  get_memory_usage(): number
}

class WASMImageProcessorLoader {
  private module: WASMImageProcessor | null = null
  private loading: Promise<WASMImageProcessor> | null = null

  async loadModule(): Promise<WASMImageProcessor> {
    if (this.module) {
      return this.module
    }

    if (this.loading) {
      return this.loading
    }

    this.loading = this.loadModuleInternal()
    return this.loading
  }

  private async loadModuleInternal(): Promise<WASMImageProcessor> {
    // Client-side only
    if (typeof window === 'undefined') {
      throw new Error('WASM modules can only be loaded on the client side')
    }

    return new Promise((resolve, reject) => {
      // Create script element to load the WASM JS file
      const script = document.createElement('script')
      script.src = '/wasm/portfolio_wasm.js'

      script.onload = async () => {
        try {
          // Access the global wasm_bindgen function
          const wasmBindgen = (window as any).wasm_bindgen

          if (!wasmBindgen) {
            throw new Error('wasm_bindgen not found in global scope')
          }

          // Initialize the WASM module
          await wasmBindgen('/wasm/portfolio_wasm_bg.wasm')

          // Create the processor interface
          const processor: WASMImageProcessor = {
            apply_blur: wasmBindgen.apply_blur,
            apply_edge_detection: wasmBindgen.apply_edge_detection,
            apply_color_filter: wasmBindgen.apply_color_filter,
            adjust_brightness: wasmBindgen.adjust_brightness,
            adjust_contrast: wasmBindgen.adjust_contrast,
            apply_sharpen: wasmBindgen.apply_sharpen,
            get_memory_usage: wasmBindgen.get_memory_usage || (() => 0)
          }

          this.module = processor
          resolve(processor)
        } catch (error) {
          reject(error)
        }
      }

      script.onerror = () => {
        reject(new Error('Failed to load WASM script'))
      }

      // Add script to document
      document.head.appendChild(script)
    })
  }

  getModule(): WASMImageProcessor | null {
    return this.module
  }
}

// Singleton instance
export const wasmImageProcessor = new WASMImageProcessorLoader()

// Convenience function
export async function loadWASMImageProcessor(): Promise<WASMImageProcessor> {
  return wasmImageProcessor.loadModule()
}
