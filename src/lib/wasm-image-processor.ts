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
      script.type = 'module'
      script.textContent = `
        import init, * as wasmModule from '/wasm/portfolio_wasm.js';

        (async () => {
          try {
            // Initialize the WASM module
            await init('/wasm/portfolio_wasm_bg.wasm');

            // Store the module functions on window for access
            window.__wasmImageProcessor = {
              apply_blur: wasmModule.apply_blur,
              apply_edge_detection: wasmModule.apply_edge_detection,
              apply_color_filter: wasmModule.apply_color_filter,
              adjust_brightness: wasmModule.adjust_brightness,
              adjust_contrast: wasmModule.adjust_contrast,
              apply_sharpen: wasmModule.apply_sharpen,
              get_memory_usage: wasmModule.get_memory_usage || (() => 0)
            };

            // Dispatch custom event to signal completion
            window.dispatchEvent(new CustomEvent('wasmLoaded'));
          } catch (error) {
            window.dispatchEvent(new CustomEvent('wasmError', { detail: error }));
          }
        })();
      `

      // Listen for completion events
      const handleWasmLoaded = () => {
        const wasmProcessor = (window as any).__wasmImageProcessor
        if (wasmProcessor) {
          this.module = wasmProcessor
          resolve(wasmProcessor)
        } else {
          reject(new Error('WASM module loaded but functions not available'))
        }
        cleanup()
      }

      const handleWasmError = (event: CustomEvent) => {
        reject(new Error(`WASM loading failed: ${event.detail}`))
        cleanup()
      }

      const cleanup = () => {
        window.removeEventListener('wasmLoaded', handleWasmLoaded)
        window.removeEventListener('wasmError', handleWasmError as EventListener)
        document.head.removeChild(script)
      }

      window.addEventListener('wasmLoaded', handleWasmLoaded)
      window.addEventListener('wasmError', handleWasmError as EventListener)

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
