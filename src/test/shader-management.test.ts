import { vi, describe, it, expect, beforeEach } from 'vitest'
import { ShaderManager } from '../lib/shader-management/ShaderManager'
import { ShaderCompilationError } from '../types/shader'

const GL_FLOAT = 0x1406
const GL_BOOL = 0x8b56

// The uniforms the mock program reports as active
const ACTIVE = [
  { name: 'time', type: GL_FLOAT },
  { name: 'u_mousePressed', type: GL_BOOL }
]

const createGL = () => {
  const sources = new Map<object, string>()
  return {
    VERTEX_SHADER: 35633,
    FRAGMENT_SHADER: 35632,
    COMPILE_STATUS: 35713,
    LINK_STATUS: 35714,
    ACTIVE_UNIFORMS: 35718,
    createShader: vi.fn(() => ({})),
    shaderSource: vi.fn((shader: object, source: string) => sources.set(shader, source)),
    compileShader: vi.fn(),
    getShaderParameter: vi.fn((shader: object) => !sources.get(shader)?.includes('INVALID')),
    getShaderInfoLog: vi.fn(() => 'Shader compilation error'),
    deleteShader: vi.fn(),
    createProgram: vi.fn(() => ({})),
    attachShader: vi.fn(),
    linkProgram: vi.fn(),
    getProgramParameter: vi.fn((_program: object, pname: number) => (pname === 35718 ? ACTIVE.length : true)),
    getProgramInfoLog: vi.fn(() => null),
    deleteProgram: vi.fn(),
    useProgram: vi.fn(),
    getActiveUniform: vi.fn((_program: object, index: number) => ACTIVE[index]),
    getUniformLocation: vi.fn((_program: object, name: string) => ({ name })),
    uniform1f: vi.fn(),
    uniform1i: vi.fn(),
    uniform2fv: vi.fn(),
    uniform3f: vi.fn()
  }
}

const VERTEX = 'void main() { gl_Position = vec4(0.0); }'
const FRAGMENT = 'void main() { gl_FragColor = vec4(1.0); }'

describe('ShaderManager', () => {
  let gl: ReturnType<typeof createGL>
  let manager: ShaderManager

  beforeEach(() => {
    gl = createGL()
    manager = new ShaderManager(gl as unknown as WebGLRenderingContext)
  })

  it('creates, uses and feeds a program, sending booleans as integers', () => {
    manager.createProgram('test', VERTEX, FRAGMENT)
    expect(manager.hasProgram('test')).toBe(true)
    expect(() => manager.useProgram('test')).not.toThrow()

    manager.setUniforms('test', { time: 1.5, u_mousePressed: true })
    expect(gl.uniform1f).toHaveBeenCalledWith({ name: 'time' }, 1.5)
    expect(gl.uniform1i).toHaveBeenCalledWith({ name: 'u_mousePressed' }, 1)

    manager.setUniforms('test', { u_mousePressed: false })
    expect(gl.uniform1i).toHaveBeenLastCalledWith({ name: 'u_mousePressed' }, 0)
  })

  it('recompiles when the source changes under the same id, and deletes the old program', () => {
    manager.createProgram('test', VERTEX, FRAGMENT)
    manager.createProgram('other', VERTEX, FRAGMENT)
    // Identical sources are compiled once
    expect(gl.createShader).toHaveBeenCalledTimes(2)

    manager.createProgram('test', VERTEX, FRAGMENT.replace('1.0', '0.5'))
    expect(gl.createShader).toHaveBeenCalledTimes(3)
    expect(gl.deleteProgram).toHaveBeenCalledTimes(1)
  })

  it('keeps the last good program when a reload fails to compile', async () => {
    manager.createProgram('test', VERTEX, FRAGMENT)
    await expect(manager.reloadProgram('test', VERTEX, 'INVALID')).rejects.toThrow(ShaderCompilationError)
    expect(gl.deleteProgram).not.toHaveBeenCalled()
    expect(() => manager.useProgram('test')).not.toThrow()
  })

  it('skips a uniform the program does not have without warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    manager.createProgram('test', VERTEX, FRAGMENT)
    manager.setUniforms('test', { mouse: [1, 2] })
    expect(gl.uniform2fv).not.toHaveBeenCalled()
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('names the programs that do exist when asked for one that does not', () => {
    manager.createProgram('existing', VERTEX, FRAGMENT)
    expect(() => manager.useProgram('missing')).toThrow(
      'Shader program "missing" not found. Available programs: existing'
    )
  })
})
