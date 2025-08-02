import { vi, describe, it, expect, beforeEach } from 'vitest'
import { ShaderManager } from '../lib/shader-management/ShaderManager'

// Mock WebGL context
class MockWebGLRenderingContext {
  VERTEX_SHADER = 35633
  FRAGMENT_SHADER = 35632
  COMPILE_STATUS = 35713
  LINK_STATUS = 35714
  ACTIVE_UNIFORMS = 35718

  createShader(): WebGLShader {
    return { id: Math.random() } as WebGLShader
  }

  shaderSource(): void {}
  compileShader(): void {}
  getShaderParameter(): boolean {
    return true
  }
  getShaderInfoLog(): string {
    return ''
  }
  deleteShader(): void {}

  createProgram(): WebGLProgram {
    return { id: Math.random() } as WebGLProgram
  }

  attachShader(): void {}
  linkProgram(): void {}
  getProgramParameter(): boolean {
    return true
  }
  getProgramInfoLog(): string {
    return ''
  }
  deleteProgram(): void {}
  useProgram(): void {}

  getActiveUniform(): WebGLActiveInfo | null {
    return null
  }
  getUniformLocation(): WebGLUniformLocation | null {
    return null
  }
}

describe('ShaderManager Timing Fix', () => {
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
    void main() {
      gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
    }
  `

  beforeEach(() => {
    gl = new MockWebGLRenderingContext()
    shaderManager = new ShaderManager(gl as any)
  })

  it('should handle useProgram calls before program creation gracefully', () => {
    // This should not throw an error but return false
    expect(shaderManager.hasProgram('nonexistent')).toBe(false)

    // This should throw a descriptive error
    expect(() => {
      shaderManager.useProgram('nonexistent')
    }).toThrow('Shader program "nonexistent" not found')
  })

  it('should allow checking program existence before using it', () => {
    // Initially no program exists
    expect(shaderManager.hasProgram('test')).toBe(false)

    // Create the program
    shaderManager.createProgram('test', validVertexShader, validFragmentShader)

    // Now it should exist
    expect(shaderManager.hasProgram('test')).toBe(true)

    // And we should be able to use it
    expect(() => {
      shaderManager.useProgram('test')
    }).not.toThrow()
  })

  it('should provide helpful error messages when program not found', () => {
    // Create one program
    shaderManager.createProgram('existing', validVertexShader, validFragmentShader)

    // Try to use a non-existent program
    expect(() => {
      shaderManager.useProgram('missing')
    }).toThrow('Shader program "missing" not found. Available programs: existing')
  })
})
