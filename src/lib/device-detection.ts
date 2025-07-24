import { DeviceCapabilities, QualityLevel } from '@/types'

export interface ExtendedDeviceCapabilities extends DeviceCapabilities {
  gpu: GPUInfo
  network: NetworkInfo
  battery?: BatteryInfo
  performanceScore: number
}

export interface GPUInfo {
  vendor: string
  renderer: string
  maxFragmentUniforms: number
  maxVertexAttributes: number
  maxVaryingVectors: number
  maxCombinedTextureImageUnits: number
  supportsFloatTextures: boolean
  supportsHalfFloatTextures: boolean
  maxAnisotropy: number
}

export interface NetworkInfo {
  effectiveType: string
  downlink: number
  rtt: number
  saveData: boolean
}

export interface BatteryInfo {
  charging: boolean
  level: number
  chargingTime: number
  dischargingTime: number
}

export class DeviceDetector {
  private static instance: DeviceDetector
  private capabilities: ExtendedDeviceCapabilities | null = null
  private performanceTests: Map<string, number> = new Map()

  static getInstance(): DeviceDetector {
    if (!DeviceDetector.instance) {
      DeviceDetector.instance = new DeviceDetector()
    }
    return DeviceDetector.instance
  }

  async detectCapabilities(): Promise<ExtendedDeviceCapabilities> {
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

    // Get detailed GPU information
    const gpu = this.detectGPUInfo(gl)

    // Get network information
    const network = this.detectNetworkInfo()

    // Get battery information (if available)
    const battery = await this.detectBatteryInfo()

    // Run performance benchmarks
    const performanceScore = await this.calculatePerformanceScore(gl)

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
      cores,
      gpu,
      network,
      battery,
      performanceScore
    }

    // Cleanup
    canvas.remove()

    return this.capabilities
  }

  private detectGPUInfo(gl: WebGLRenderingContext | WebGL2RenderingContext): GPUInfo {
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
    const vendor = debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : 'Unknown'
    const renderer = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'Unknown'

    // Get texture capabilities
    const floatTextureExt = gl.getExtension('OES_texture_float')
    const halfFloatTextureExt = gl.getExtension('OES_texture_half_float')
    const anisotropyExt = gl.getExtension('EXT_texture_filter_anisotropic')

    return {
      vendor,
      renderer,
      maxFragmentUniforms: gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS),
      maxVertexAttributes: gl.getParameter(gl.MAX_VERTEX_ATTRIBS),
      maxVaryingVectors: gl.getParameter(gl.MAX_VARYING_VECTORS),
      maxCombinedTextureImageUnits: gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS),
      supportsFloatTextures: !!floatTextureExt,
      supportsHalfFloatTextures: !!halfFloatTextureExt,
      maxAnisotropy: anisotropyExt ? gl.getParameter(anisotropyExt.MAX_TEXTURE_MAX_ANISOTROPY_EXT) : 1
    }
  }

  private detectNetworkInfo(): NetworkInfo {
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection

    if (connection) {
      return {
        effectiveType: connection.effectiveType || '4g',
        downlink: connection.downlink || 10,
        rtt: connection.rtt || 100,
        saveData: connection.saveData || false
      }
    }

    // Fallback values
    return {
      effectiveType: '4g',
      downlink: 10,
      rtt: 100,
      saveData: false
    }
  }

  private async detectBatteryInfo(): Promise<BatteryInfo | undefined> {
    try {
      if ('getBattery' in navigator) {
        const battery = await (navigator as any).getBattery()
        return {
          charging: battery.charging,
          level: battery.level,
          chargingTime: battery.chargingTime,
          dischargingTime: battery.dischargingTime
        }
      }
    } catch (error) {
      console.warn('Battery API not available:', error)
    }
    return undefined
  }

  private async calculatePerformanceScore(gl: WebGLRenderingContext | WebGL2RenderingContext): Promise<number> {
    let score = 0

    // Base score from WebGL version
    score += gl instanceof WebGL2RenderingContext ? 30 : 20

    // GPU performance test
    const gpuScore = await this.runGPUBenchmark(gl)
    score += gpuScore

    // CPU performance test
    const cpuScore = this.runCPUBenchmark()
    score += cpuScore

    // Memory score
    const memoryScore = this.calculateMemoryScore()
    score += memoryScore

    // Network score
    const networkScore = this.calculateNetworkScore()
    score += networkScore

    return Math.min(100, Math.max(0, score))
  }

  private async runGPUBenchmark(gl: WebGLRenderingContext | WebGL2RenderingContext): Promise<number> {
    try {
      const startTime = performance.now()

      // Create a simple shader program for testing
      const vertexShader = gl.createShader(gl.VERTEX_SHADER)!
      gl.shaderSource(vertexShader, `
        attribute vec2 position;
        void main() {
          gl_Position = vec4(position, 0.0, 1.0);
        }
      `)
      gl.compileShader(vertexShader)

      // Check for compilation errors
      if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
        console.warn('Vertex shader compilation failed:', gl.getShaderInfoLog(vertexShader))
        return 10 // Fallback score
      }

      const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!
      gl.shaderSource(fragmentShader, `
        precision mediump float;
        uniform float time;
        void main() {
          vec2 uv = gl_FragCoord.xy / vec2(512.0);
          float color = sin(uv.x * 10.0 + time) * sin(uv.y * 10.0 + time);
          gl_FragColor = vec4(color, color, color, 1.0);
        }
      `)
      gl.compileShader(fragmentShader)

      // Check for compilation errors
      if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
        console.warn('Fragment shader compilation failed:', gl.getShaderInfoLog(fragmentShader))
        gl.deleteShader(vertexShader)
        return 10 // Fallback score
      }

      const program = gl.createProgram()!
      gl.attachShader(program, vertexShader)
      gl.attachShader(program, fragmentShader)
      gl.linkProgram(program)

      // Check for linking errors
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.warn('Shader program linking failed:', gl.getProgramInfoLog(program))
        gl.deleteShader(vertexShader)
        gl.deleteShader(fragmentShader)
        gl.deleteProgram(program)
        return 10 // Fallback score
      }

      // Create a simple buffer for testing
      const buffer = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 0, 1]), gl.STATIC_DRAW)

      const positionLocation = gl.getAttribLocation(program, 'position')
      gl.enableVertexAttribArray(positionLocation)
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0)

      // Render multiple frames to test performance
      const frameCount = 30 // Reduced for better compatibility
      gl.useProgram(program)

      for (let i = 0; i < frameCount; i++) {
        gl.uniform1f(gl.getUniformLocation(program, 'time'), i * 0.016)
        gl.drawArrays(gl.TRIANGLES, 0, 3)
      }

      // Force completion
      gl.finish()

      const endTime = performance.now()
      const renderTime = endTime - startTime

      // Cleanup
      gl.deleteBuffer(buffer)
      gl.deleteShader(vertexShader)
      gl.deleteShader(fragmentShader)
      gl.deleteProgram(program)

      // Store performance test result
      this.performanceTests.set('gpu', Math.max(0, 30 - (renderTime / 10)))

      // Score based on render time (lower is better)
      return Math.max(0, 30 - (renderTime / 10))
    } catch (error) {
      console.warn('GPU benchmark failed:', error)
      return 5 // Very low fallback score
    }
  }

  private runCPUBenchmark(): number {
    try {
      const startTime = performance.now()

      // Simple CPU-intensive calculation
      let result = 0
      const iterations = 50000 // Reduced for better compatibility

      for (let i = 0; i < iterations; i++) {
        result += Math.sin(i * 0.01) * Math.cos(i * 0.01)
      }

      const endTime = performance.now()
      const cpuTime = endTime - startTime

      // Store performance test result
      const score = Math.max(0, 20 - (cpuTime / 5))
      this.performanceTests.set('cpu', score)

      // Score based on CPU time (lower is better)
      return score
    } catch (error) {
      console.warn('CPU benchmark failed:', error)
      return 5 // Fallback score
    }
  }

  private calculateMemoryScore(): number {
    try {
      if ('memory' in performance) {
        const memory = (performance as any).memory
        const totalMemoryMB = memory.jsHeapSizeLimit / (1024 * 1024)
        const usedMemoryMB = memory.usedJSHeapSize / (1024 * 1024)

        let score = 10 // Base score

        // Score based on total memory
        if (totalMemoryMB > 2000) score += 10
        else if (totalMemoryMB > 1000) score += 7
        else if (totalMemoryMB > 500) score += 5
        else score += 2

        // Penalty for high memory usage
        const memoryUsageRatio = usedMemoryMB / totalMemoryMB
        if (memoryUsageRatio > 0.8) score -= 5
        else if (memoryUsageRatio > 0.6) score -= 2

        const finalScore = Math.max(2, Math.min(20, score))
        this.performanceTests.set('memory', finalScore)
        return finalScore
      }

      // Fallback estimation based on device characteristics
      const userAgent = navigator.userAgent.toLowerCase()
      let estimatedScore = 10

      if (/mobile|android|iphone/i.test(userAgent)) {
        estimatedScore = 6 // Lower score for mobile
      } else if (/ipad/i.test(userAgent)) {
        estimatedScore = 8 // Medium score for tablets
      } else {
        estimatedScore = 12 // Higher score for desktop
      }

      this.performanceTests.set('memory', estimatedScore)
      return estimatedScore
    } catch (error) {
      console.warn('Memory score calculation failed:', error)
      return 8 // Safe fallback
    }
  }

  private calculateNetworkScore(): number {
    const network = this.detectNetworkInfo()

    if (network.effectiveType === '4g' && network.downlink > 5) return 10
    if (network.effectiveType === '3g' || network.downlink > 2) return 7
    if (network.effectiveType === '2g' || network.downlink > 0.5) return 4
    return 2
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

    const { isMobile, memoryGB, webglVersion, cores, performanceScore, network, battery } = this.capabilities

    // Consider battery level for mobile devices
    if (battery && !battery.charging && battery.level < 0.2) {
      return QualityLevel.LOW
    }

    // Consider network conditions
    if (network.saveData || network.effectiveType === '2g') {
      return QualityLevel.LOW
    }

    // Enhanced quality determination with more factors
    let qualityScore = performanceScore

    // Adjust for device type
    if (isMobile) {
      qualityScore *= 0.8 // Mobile penalty
    } else if (this.capabilities.isTablet) {
      qualityScore *= 0.9 // Tablet penalty
    }

    // Adjust for memory constraints
    if (memoryGB < 2) {
      qualityScore *= 0.6
    } else if (memoryGB < 4) {
      qualityScore *= 0.8
    }

    // Adjust for WebGL version
    if (webglVersion < 2) {
      qualityScore *= 0.7
    }

    // Adjust for CPU cores
    if (cores < 4) {
      qualityScore *= 0.8
    }

    // Network quality adjustment
    if (network.effectiveType === '3g') {
      qualityScore *= 0.9
    } else if (network.effectiveType === '2g') {
      qualityScore *= 0.5
    }

    // Battery adjustment for non-charging devices
    if (battery && !battery.charging) {
      if (battery.level < 0.5) {
        qualityScore *= 0.8
      }
      if (battery.level < 0.3) {
        qualityScore *= 0.6
      }
    }

    // Determine quality level based on adjusted score
    if (qualityScore >= 75) {
      return isMobile ? QualityLevel.HIGH : QualityLevel.ULTRA
    }
    if (qualityScore >= 55) {
      return QualityLevel.HIGH
    }
    if (qualityScore >= 35) {
      return QualityLevel.MEDIUM
    }

    return QualityLevel.LOW
  }

  getCapabilities(): ExtendedDeviceCapabilities | null {
    return this.capabilities
  }

  // Get specific capability scores for fine-tuned adjustments
  getGPUScore(): number {
    if (!this.capabilities) return 0
    return this.performanceTests.get('gpu') || 0
  }

  getCPUScore(): number {
    if (!this.capabilities) return 0
    return this.performanceTests.get('cpu') || 0
  }

  getMemoryScore(): number {
    if (!this.capabilities) return 0
    return this.performanceTests.get('memory') || 0
  }

  // Check for specific feature support
  supportsAdvancedShaders(): boolean {
    if (!this.capabilities) return false
    return this.capabilities.webglVersion >= 2 && this.capabilities.gpu.supportsFloatTextures
  }

  supportsHighQualityTextures(): boolean {
    if (!this.capabilities) return false
    return this.capabilities.maxTextureSize >= 2048 && this.capabilities.memoryGB >= 4
  }

  shouldUseLowPowerMode(): boolean {
    if (!this.capabilities) return false
    const { battery, isMobile } = this.capabilities
    return isMobile && battery && !battery.charging && battery.level < 0.3 || false
  }
}
