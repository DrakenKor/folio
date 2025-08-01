import { vi } from 'vitest'
import { ShaderManager } from '../lib/shader-management/ShaderManager'
import { ShaderCompilationError } from '../types/shader'

// Mock WebGL context
class MockWebGLRenderingContext {
  VERTEX_SHADER = 35633
  FRAGMENT_SHADER = 35632
  COMPILE_STATUS = 35713
  LINK_STATUS = 35714
  ACTIVE_UNIFORMS = 35718

  private shaderCounter = 0
  private programCounter = 0
  private shaders = new Map<WebGLShader, { source: string; type: number; compiled: boolean }>()
  private programs = new Map<WebGLProgram, { linked: boolean; shaders: WebGLShader[] }>()

  createShader(type: number): WebGLShader | null {
    const shader = { id: ++this.shaderCounter } as WebGLShader
    this.shaders.set(shader, { source: '', type, compiled: false })
    return shader
  }

  shaderSource(shader: WebGLShader, source: string): void {
    const shaderData = this.shaders.get(shader)
    if (shaderData) {
      shaderData.source = source
    }
  }

  compileShader(shader: WebGLShader): void {
    const shaderData = this.shaders.get(shader)
    if (shaderData) {
      // Simulate compilation success for valid shaders
      shaderData.compiled = !shaderData.source.includes('INVALID')
    }
  }

  getShaderParameter(shader: WebGLShader, pname: number): boolean {
    if (pname === this.COMPILE_STATUS) {
      return this.shaders.get(shader)?.compiled || false
    }
    return false
  }

  getShaderInfoLog(shader: WebGLShader): string | null {
    const shaderData = this.shaders.get(shader)
    if (shaderData && !shaderData.compiled) {
      return 'Shader compilation error'
    }
    return null
  }

  deleteShader(shader: WebGLShader): void {
    this.shaders.delete(shader)
  }

  createProgram(): WebGLProgram | null {
    const program = { id: ++this.programCounter } as WebGLProgram
    this.programs.set(program, { linked: false, shaders: [] })
    return program
  }

  attachShader(program: WebGLProgram, shader: WebGLShader): void {
    const programData = this.programs.get(program)
    if (programData) {
      programData.shaders.push(shader)
    }
  }

  linkProgram(program: WebGLProgram): void {
    const programData = this.programs.get(program)
    if (programData) {
      // Simulate successful linking if all shaders are compiled
      programData.linked = programData.shaders.every(shader =>
        this.shaders.get(shader)?.compiled
      )
    }
  }

  getProgramParameter(program: WebGLProgram, pname: number): boolean {
    if (pname === this.LINK_STATUS) {
      return this.programs.get(program)?.linked || false
    }
    if (pname === this.ACTIVE_UNIFORMS) {
      return 2 // Mock uniform count
    }
    return false
  }

  getProgramInfoLog(program: WebGLProgram): string | null {
    const programData = this.programs.get(program)
    if (programData && !programData.linked) {
      return 'Program linking error'
    }
    return null
  }

  deleteProgram(program: WebGLProgram): void {
    this.programs.delete(program)
  }

  useProgram(program: WebGLProgram | null): void {
    // Mock implementation
  }

  getActiveUniform(program: WebGLProgram, index: number): WebGLActiveInfo | null {
    const uniforms = ['time', 'resolution']
    if (index < uniforms.length) {
      return {
        name: uniforms[index],
        size: 1,
        type: 5126 // FLOAT
      } as WebGLActiveInfo
    }
    return null
  }

  getUniformLocation(program: WebGLProgram, name: string): WebGLUniformLocation | null {
    return { name } as WebGLUniformLocation
  }

  uniform1f(location: WebGLUniformLocation, value: number): void {
    // Mock implementation
  }

  uniform2fv(location: WebGLUniformLocation, value: Float32Array | number[]): void {
    // Mock implementation
  }

  uniform3fv(location: WebGLUniformLocation, value: Float32Array | number[]): void {
    // Mock implementation
  }

  uniform4fv(location: WebGLUniformLocation, value: Float32Array | number[]): void {
    // Mock implementation
  }

  uniformMatrix3fv(location: WebGLUniformLocation, transpose: boolean, value: Float32Array | number[]): void {
    // Mock implementation
  }

  uniformMatrix4fv(location: WebGLUniformLocation, transpose: boolean, value: Float32Array | number[]): void {
    // Mock implementation
  }

  uniform2f(location: WebGLUniformLocation, x: number, y: number): void {
    // Mock implementation
  }

  uniform3f(location: WebGLUniformLocation, x: number, y: number, z: number): void {
    // Mock implementation
  }

  uniform4f(location: WebGLUniformLocation, x: number, y: number, z: number, w: number): void {
    // Mock implementation
  }
}

describe('ShaderManager', () => {
  let gl: MockWebGLRenderingContext
  let shaderManager: ShaderManager

  const validVertexShader = `
    attribute vec2 a_position;
    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `

  const validFragmentShader = `
    precision mediump float;
    uniform float time;
    uniform vec2 resolution;
    void main() {
      gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
    }
  `

  const invalidFragmentShader = `
    precision mediump float;
    INVALID SYNTAX HERE
    void main() {
      gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
    }
  `

  beforeEach(() => {
    gl = new MockWebGLRenderingContext() as any
    shaderManager = new ShaderManager(gl as any)
  })

  afterEach(() => {
    shaderManager.dispose()
  })

  describe('createProgram', () => {
    it('should create a shader program successfully', () => {
      const program = shaderManager.createProgram('test', validVertexShader, validFragmentShader)
      expect(program).toBeDefined()
    })

    it('should throw error for invalid shader', () => {
      expect(() => {
        shaderManager.createProgram('test', validVertexShader, invalidFragmentShader)
      }).toThrow(ShaderCompilationError)
    })

    it('should cache shaders for reuse', () => {
      shaderManager.createProgram('test1', validVertexShader, validFragmentShader)
      shaderManager.createProgram('test2', validVertexShader, validFragmentShader)

      // Should not throw and reuse cached shaders
      expect(() => {
        shaderManager.createProgram('test3', validVertexShader, validFragmentShader)
      }).not.toThrow()
    })
  })

  describe('useProgram', () => {
    it('should use an existing program', () => {
      shaderManager.createProgram('test', validVertexShader, validFragmentShader)
      const program = shaderManager.useProgram('test')
      expect(program).toBeDefined()
    })

    it('should throw error for non-existent program', () => {
      expect(() => {
        shaderManager.useProgram('nonexistent')
      }).toThrow('Shader program "nonexistent" not found')
    })
  })

  describe('setUniforms', () => {
    beforeEach(() => {
      shaderManager.createProgram('test', validVertexShader, validFragmentShader)
    })

    it('should set uniform values', () => {
      expect(() => {
        shaderManager.setUniforms('test', {
          time: 1.5,
          resolution: [800, 600]
        })
      }).not.toThrow()
    })

    it('should handle vector-like objects', () => {
      expect(() => {
        shaderManager.setUniforms('test', {
          resolution: { x: 800, y: 600 }
        })
      }).not.toThrow()
    })

    it('should warn for unknown uniforms', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      shaderManager.setUniforms('test', {
        unknownUniform: 1.0
      })

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Uniform "unknownUniform" not found')
      )

      consoleSpy.mockRestore()
    })
  })

  describe('reloadProgram', () => {
    it('should reload a program successfully', async () => {
      shaderManager.createProgram('test', validVertexShader, validFragmentShader)

      await expect(
        shaderManager.reloadProgram('test', validVertexShader, validFragmentShader)
      ).resolves.not.toThrow()
    })

    it('should throw error when reloading with invalid shader', async () => {
      shaderManager.createProgram('test', validVertexShader, validFragmentShader)

      await expect(
        shaderManager.reloadProgram('test', validVertexShader, invalidFragmentShader)
      ).rejects.toThrow()
    })
  })

  describe('getProgramInfo', () => {
    it('should return program info for existing program', () => {
      shaderManager.createProgram('test', validVertexShader, validFragmentShader)
      const info = shaderManager.getProgramInfo('test')

      expect(info).toEqual({
        id: 'test',
        program: expect.any(Object),
        uniforms: expect.arrayContaining(['time', 'resolution']),
        isValid: true
      })
    })

    it('should return null for non-existent program', () => {
      const info = shaderManager.getProgramInfo('nonexistent')
      expect(info).toBeNull()
    })
  })

  describe('dispose', () => {
    it('should clean up all resources', () => {
      shaderManager.createProgram('test1', validVertexShader, validFragmentShader)
      shaderManager.createProgram('test2', validVertexShader, validFragmentShader)

      expect(() => {
        shaderManager.dispose()
      }).not.toThrow()

      // Should not be able to use programs after disposal
      expect(() => {
        shaderManager.useProgram('test1')
      }).toThrow()
    })
  })
})
