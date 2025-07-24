// Extended Three.js type definitions
import * as THREE from 'three'

declare module 'three' {
  interface WebGLRenderer {
    info: {
      memory: {
        geometries: number
        textures: number
      }
      render: {
        frame: number
        calls: number
        triangles: number
        points: number
        lines: number
      }
      programs: any[]
    }
  }
}

// Shader types
export interface ShaderUniforms {
  time: { value: number }
  resolution: { value: THREE.Vector2 }
  mouse: { value: THREE.Vector2 }
  [key: string]: { value: any }
}

export interface ShaderMaterial extends THREE.ShaderMaterial {
  uniforms: ShaderUniforms
}

// Performance monitoring types
export interface RenderStats {
  fps: number
  frameTime: number
  renderTime: number
  memoryUsage: number
  drawCalls: number
  triangles: number
  geometries: number
  textures: number
}
