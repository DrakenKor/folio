export type ShaderType = 'vertex' | 'fragment'

export interface ShaderProgram {
  id: string
  vertexShader: string
  fragmentShader: string
  uniforms: ShaderUniforms
}

export interface ShaderUniforms {
  time?: number
  resolution?: [number, number]
  mouse?: [number, number]
  [key: string]: any
}

export interface ShaderPreset {
  id: string
  name: string
  description: string
  vertexShader: string
  fragmentShader: string
  defaultUniforms: ShaderUniforms
  controls?: ShaderControl[]
}

export interface ShaderControl {
  name: string
  type: 'float' | 'vec2' | 'vec3' | 'vec4' | 'int' | 'bool' | 'color'
  min?: number
  max?: number
  step?: number
  default: any
  label: string
}

export class ShaderCompilationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ShaderCompilationError'
  }
}

export interface ShaderPlaygroundState {
  currentPreset: string
  uniforms: ShaderUniforms
  isPlaying: boolean
  showControls: boolean
}
