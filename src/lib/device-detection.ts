import { DeviceCapabilities, QualityLevel } from '@/types'

export class DeviceDetector {
  private static instance: DeviceDetector
  private capabilities: DeviceCapabilities | null = null

  static getInstance(): DeviceDetector {
    if (!DeviceDetector.instance) {
      DeviceDetector.instance = new DeviceDetector()
    }
    return DeviceDetector.instance
  }

  async detectCapabilities(): Promise<DeviceCapabilities> {
    if (this.capabilities) {
      return this.capabilities
    }

    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')

    if (!gl) {
      throw new Error('WebGL not supported')
    }

    // Detect WebGL version and capabilities
    const webglVersion = gl instanceof WebGL2RenderingContext ? 2 : 1
    const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE)
    const maxVertexUniforms = gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS)

    // Detect device type
    const userAgent = navigator.userAgent.toLowerCase()
    const isMobile = /mobile|android|iphone|ipad|phone/i.test(userAgent)
    const isTablet = /tablet|ipad/i.test(userAgent) && !isMobile
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0

    // Estimate memory and cores
    const memoryGB = this.estimateMemory()
    const cores = navigator.hardwareConcurrency || 4

    // Test WASM support
    const supportsWASM = this.testWASMSupport()
    const supportsWebWorkers = typeof Worker !== 'undefined'

    this.capabilities = {
      webglVersion,
      maxTextureSize,
      maxVertexUniforms,
      supportsWASM,
      supportsWebWorkers,
      isMobile,
      isTablet,
      hasTouch,
      memoryGB,
      cores
    }

    // Cleanup
    canvas.remove()

    return this.capabilities
  }

  private estimateMemory(): number {
    // Use performance.memory if available (Chrome)
    if ('memory' in performance) {
      const memory = (performance as any).memory
      return Math.round(memory.jsHeapSizeLimit / (1024 * 1024 * 1024))
    }

    // Fallback estimation based on device type
    const userAgent = navigator.userAgent.toLowerCase()
    if (/mobile|android|iphone/i.test(userAgent)) {
      return 2 // Assume 2GB for mobile
    }
    if (/ipad/i.test(userAgent)) {
      return 4 // Assume 4GB for tablets
    }
    return 8 // Assume 8GB for desktop
  }

  private testWASMSupport(): boolean {
    try {
      if (typeof WebAssembly === 'object' && typeof WebAssembly.instantiate === 'function') {
        // Test with a minimal WASM module
        const wasmModule = new WebAssembly.Module(
          new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00])
        )
        return wasmModule instanceof WebAssembly.Module
      }
    } catch (e) {
      return false
    }
    return false
  }

  getRecommendedQuality(): QualityLevel {
    if (!this.capabilities) {
      return QualityLevel.MEDIUM
    }

    const { isMobile, memoryGB, webglVersion, cores } = this.capabilities

    // Mobile devices get lower quality by default
    if (isMobile) {
      return memoryGB >= 4 ? QualityLevel.MEDIUM : QualityLevel.LOW
    }

    // Desktop quality based on specs
    if (webglVersion >= 2 && memoryGB >= 8 && cores >= 8) {
      return QualityLevel.ULTRA
    }
    if (webglVersion >= 2 && memoryGB >= 4 && cores >= 4) {
      return QualityLevel.HIGH
    }
    if (memoryGB >= 2) {
      return QualityLevel.MEDIUM
    }

    return QualityLevel.LOW
  }

  getCapabilities(): DeviceCapabilities | null {
    return this.capabilities
  }
}
