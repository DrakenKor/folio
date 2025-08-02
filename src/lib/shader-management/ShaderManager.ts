import {
  ShaderProgram,
  ShaderUniforms,
  ShaderType,
  ShaderCompilationError
} from '../../types/shader'

export class ShaderManager {
  private gl: WebGLRenderingContext | WebGL2RenderingContext
  private programs: Map<string, WebGLProgram> = new Map()
  private shaderCache: Map<string, WebGLShader> = new Map()
  private uniformLocations: Map<
    string,
    Map<string, WebGLUniformLocation | null>
  > = new Map()

  constructor(gl: WebGLRenderingContext | WebGL2RenderingContext) {
    this.gl = gl
  }

  /**
   * Compile a shader from source code
   */
  private compileShader(source: string, type: ShaderType): WebGLShader {
    const shader = this.gl.createShader(
      type === 'vertex' ? this.gl.VERTEX_SHADER : this.gl.FRAGMENT_SHADER
    )
    if (!shader) {
      throw new ShaderCompilationError('Failed to create shader')
    }

    this.gl.shaderSource(shader, source)
    this.gl.compileShader(shader)

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      const error = this.gl.getShaderInfoLog(shader)
      this.gl.deleteShader(shader)
      throw new ShaderCompilationError(`Shader compilation failed: ${error}`)
    }

    return shader
  }

  /**
   * Create and link a shader program
   */
  createProgram(
    id: string,
    vertexSource: string,
    fragmentSource: string
  ): WebGLProgram {
    try {
      // Check cache first
      const cacheKey = `${id}_vertex`
      const fragmentCacheKey = `${id}_fragment`

      let vertexShader = this.shaderCache.get(cacheKey)
      if (!vertexShader) {
        vertexShader = this.compileShader(vertexSource, 'vertex')
        this.shaderCache.set(cacheKey, vertexShader)
      }

      let fragmentShader = this.shaderCache.get(fragmentCacheKey)
      if (!fragmentShader) {
        fragmentShader = this.compileShader(fragmentSource, 'fragment')
        this.shaderCache.set(fragmentCacheKey, fragmentShader)
      }

      const program = this.gl.createProgram()
      if (!program) {
        throw new ShaderCompilationError('Failed to create shader program')
      }

      this.gl.attachShader(program, vertexShader)
      this.gl.attachShader(program, fragmentShader)
      this.gl.linkProgram(program)

      if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
        const error = this.gl.getProgramInfoLog(program)
        this.gl.deleteProgram(program)
        throw new ShaderCompilationError(`Program linking failed: ${error}`)
      }

      this.programs.set(id, program)
      this.cacheUniformLocations(id, program)

      return program
    } catch (error) {
      console.error(`Failed to create shader program "${id}":`, error)
      throw error
    }
  }

  /**
   * Cache uniform locations for efficient access
   */
  private cacheUniformLocations(
    programId: string,
    program: WebGLProgram
  ): void {
    const uniformCount = this.gl.getProgramParameter(
      program,
      this.gl.ACTIVE_UNIFORMS
    )
    const locations = new Map<string, WebGLUniformLocation | null>()

    for (let i = 0; i < uniformCount; i++) {
      const uniformInfo = this.gl.getActiveUniform(program, i)
      if (uniformInfo) {
        const location = this.gl.getUniformLocation(program, uniformInfo.name)
        locations.set(uniformInfo.name, location)
      }
    }

    this.uniformLocations.set(programId, locations)
  }

  /**
   * Use a shader program
   */
  useProgram(id: string): WebGLProgram {
    const program = this.programs.get(id)
    if (!program) {
      throw new Error(`Shader program "${id}" not found. Available programs: ${Array.from(this.programs.keys()).join(', ')}`)
    }

    this.gl.useProgram(program)
    return program
  }

  /**
   * Check if a shader program exists
   */
  hasProgram(id: string): boolean {
    return this.programs.has(id)
  }

  /**
   * Set uniform values for the currently active program
   */
  setUniforms(programId: string, uniforms: ShaderUniforms): void {
    const locations = this.uniformLocations.get(programId)
    if (!locations) {
      return
      // throw new Error(`Uniform locations for program "${programId}" not found`)
    }

    Object.entries(uniforms).forEach(([name, value]) => {
      const location = locations.get(name)
      if (location === null || location === undefined) {
        console.warn(`Uniform "${name}" not found in program "${programId}"`)
        return
      }

      this.setUniform(location, value)
    })
  }

  /**
   * Set individual uniform value
   */
  private setUniform(location: WebGLUniformLocation, value: any): void {
    if (typeof value === 'number') {
      this.gl.uniform1f(location, value)
    } else if (Array.isArray(value)) {
      switch (value.length) {
        case 2:
          this.gl.uniform2fv(location, value)
          break
        case 3:
          this.gl.uniform3fv(location, value)
          break
        case 4:
          this.gl.uniform4fv(location, value)
          break
        case 9:
          this.gl.uniformMatrix3fv(location, false, value)
          break
        case 16:
          this.gl.uniformMatrix4fv(location, false, value)
          break
        default:
          console.warn(`Unsupported uniform array length: ${value.length}`)
      }
    } else if (value && typeof value === 'object' && 'x' in value) {
      // Vector-like object
      if ('w' in value) {
        this.gl.uniform4f(location, value.x, value.y, value.z, value.w)
      } else if ('z' in value) {
        this.gl.uniform3f(location, value.x, value.y, value.z)
      } else if ('y' in value) {
        this.gl.uniform2f(location, value.x, value.y)
      }
    }
  }

  /**
   * Hot reload a shader program
   */
  async reloadProgram(
    id: string,
    vertexSource: string,
    fragmentSource: string
  ): Promise<void> {
    try {
      // Remove from cache to force recompilation
      this.shaderCache.delete(`${id}_vertex`)
      this.shaderCache.delete(`${id}_fragment`)

      // Delete existing program
      const existingProgram = this.programs.get(id)
      if (existingProgram) {
        this.gl.deleteProgram(existingProgram)
        this.programs.delete(id)
        this.uniformLocations.delete(id)
      }

      // Create new program
      this.createProgram(id, vertexSource, fragmentSource)
      console.log(`Successfully reloaded shader program: ${id}`)
    } catch (error) {
      console.error(`Failed to reload shader program "${id}":`, error)
      throw error
    }
  }

  /**
   * Get program info for debugging
   */
  getProgramInfo(id: string): any {
    const program = this.programs.get(id)
    if (!program) return null

    return {
      id,
      program,
      uniforms: Array.from(this.uniformLocations.get(id)?.keys() || []),
      isValid: this.gl.getProgramParameter(program, this.gl.LINK_STATUS)
    }
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    // Delete all programs
    this.programs.forEach((program) => {
      this.gl.deleteProgram(program)
    })

    // Delete all cached shaders
    this.shaderCache.forEach((shader) => {
      this.gl.deleteShader(shader)
    })

    this.programs.clear()
    this.shaderCache.clear()
    this.uniformLocations.clear()
  }
}
