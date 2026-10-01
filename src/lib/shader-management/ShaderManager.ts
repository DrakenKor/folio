import {
  ShaderUniforms,
  ShaderType,
  ShaderCompilationError
} from '../../types/shader'

type GL = WebGLRenderingContext | WebGL2RenderingContext

interface UniformInfo {
  location: WebGLUniformLocation
  // True for int, bool and sampler uniforms, which take uniform1i
  integer: boolean
}

// GL_INT, GL_BOOL, and the sampler types
const INTEGER_TYPES = new Set([0x1404, 0x8b56, 0x8b5e, 0x8b60, 0x8b5f, 0x8dc1])

// djb2 over the source: the cache key, so an edited shader recompiles
const hashSource = (source: string): string => {
  let hash = 5381
  for (let i = 0; i < source.length; i++) {
    hash = ((hash << 5) + hash + source.charCodeAt(i)) | 0
  }
  return (hash >>> 0).toString(36)
}

export class ShaderManager {
  private gl: GL
  private programs: Map<string, WebGLProgram> = new Map()
  private shaderCache: Map<string, WebGLShader> = new Map()
  private uniforms: Map<string, Map<string, UniformInfo>> = new Map()

  constructor(gl: GL) {
    this.gl = gl
  }

  /**
   * Compile a shader from source code, reusing an identical one if cached
   */
  private compileShader(source: string, type: ShaderType): WebGLShader {
    const cacheKey = `${type}:${hashSource(source)}:${source.length}`
    const cached = this.shaderCache.get(cacheKey)
    if (cached) return cached

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

    this.shaderCache.set(cacheKey, shader)
    return shader
  }

  /**
   * Create and link a shader program. If the id is already taken, the old
   * program is deleted only once the new one has linked, so a failed compile
   * leaves the last good program in place.
   */
  createProgram(
    id: string,
    vertexSource: string,
    fragmentSource: string
  ): WebGLProgram {
    const vertexShader = this.compileShader(vertexSource, 'vertex')
    const fragmentShader = this.compileShader(fragmentSource, 'fragment')

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

    const existing = this.programs.get(id)
    if (existing) this.gl.deleteProgram(existing)

    this.programs.set(id, program)
    this.cacheUniforms(id, program)

    return program
  }

  /**
   * Cache uniform locations and types for efficient access
   */
  private cacheUniforms(programId: string, program: WebGLProgram): void {
    const uniformCount = this.gl.getProgramParameter(
      program,
      this.gl.ACTIVE_UNIFORMS
    )
    const uniforms = new Map<string, UniformInfo>()

    for (let i = 0; i < uniformCount; i++) {
      const info = this.gl.getActiveUniform(program, i)
      if (!info) continue
      const location = this.gl.getUniformLocation(program, info.name)
      if (!location) continue
      const entry = { location, integer: INTEGER_TYPES.has(info.type) }
      uniforms.set(info.name, entry)
      // Arrays are reported as "name[0]"; accept the bare name too
      if (info.name.endsWith('[0]')) uniforms.set(info.name.slice(0, -3), entry)
    }

    this.uniforms.set(programId, uniforms)
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
   * Whether the linked program kept a uniform of this name
   */
  hasUniform(programId: string, name: string): boolean {
    return this.uniforms.get(programId)?.has(name) ?? false
  }

  /**
   * Set uniform values for the currently active program. A name the program
   * does not have is skipped: the compiler drops uniforms a shader never
   * reads, and warning about that every frame helps nobody.
   */
  setUniforms(programId: string, uniforms: ShaderUniforms): void {
    const known = this.uniforms.get(programId)
    if (!known) return

    Object.entries(uniforms).forEach(([name, value]) => {
      const uniform = known.get(name)
      if (uniform) this.setUniform(uniform, value)
    })
  }

  /**
   * Set individual uniform value
   */
  private setUniform({ location, integer }: UniformInfo, value: unknown): void {
    if (typeof value === 'boolean') {
      this.gl.uniform1i(location, value ? 1 : 0)
    } else if (typeof value === 'number') {
      if (integer) this.gl.uniform1i(location, value)
      else this.gl.uniform1f(location, value)
    } else if (Array.isArray(value) || value instanceof Float32Array) {
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
      }
    } else if (value && typeof value === 'object' && 'x' in value) {
      // Vector-like object
      const vector = value as { x: number; y?: number; z?: number; w?: number }
      if (vector.w !== undefined) {
        this.gl.uniform4f(location, vector.x, vector.y ?? 0, vector.z ?? 0, vector.w)
      } else if (vector.z !== undefined) {
        this.gl.uniform3f(location, vector.x, vector.y ?? 0, vector.z)
      } else if (vector.y !== undefined) {
        this.gl.uniform2f(location, vector.x, vector.y)
      }
    }
  }

  /**
   * Replace a program's shaders. Throws, and keeps the old program, if the
   * new source does not compile.
   */
  async reloadProgram(
    id: string,
    vertexSource: string,
    fragmentSource: string
  ): Promise<void> {
    this.createProgram(id, vertexSource, fragmentSource)
  }

  /**
   * Get program info for debugging
   */
  getProgramInfo(id: string): { id: string; program: WebGLProgram; uniforms: string[]; isValid: boolean } | null {
    const program = this.programs.get(id)
    if (!program) return null

    return {
      id,
      program,
      uniforms: Array.from(this.uniforms.get(id)?.keys() || []),
      isValid: this.gl.getProgramParameter(program, this.gl.LINK_STATUS)
    }
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    this.programs.forEach((program) => {
      this.gl.deleteProgram(program)
    })

    this.shaderCache.forEach((shader) => {
      this.gl.deleteShader(shader)
    })

    this.programs.clear()
    this.shaderCache.clear()
    this.uniforms.clear()
  }
}
