// Core application types
export interface AppConfig {
  performance: PerformanceConfig
  features: FeatureFlags
  quality: QualityLevel
}

export interface PerformanceConfig {
  targetFPS: number
  maxParticles: number
  enableShadows: boolean
  enablePostProcessing: boolean
  adaptiveQuality: boolean
}

export interface FeatureFlags {
  enable3D: boolean
  enableWASM: boolean
  enableShaders: boolean
  enableAudio: boolean
  enableParticles: boolean
}

export enum QualityLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  ULTRA = 'ultra'
}

export interface DeviceCapabilities {
  webglVersion: number
  maxTextureSize: number
  maxVertexUniforms: number
  supportsWASM: boolean
  supportsWebWorkers: boolean
  isMobile: boolean
  isTablet: boolean
  hasTouch: boolean
  memoryGB: number
  cores: number
}

export interface PerformanceMetrics {
  fps: number
  memoryUsage: number
  renderTime: number
  frameTime: number
  drawCalls: number
  triangles: number
}

// Navigation types
export enum SectionType {
  HOME = 'home',
  RESUME = 'resume',
  MATH_GALLERY = 'math-gallery',
  CODE_VISUALIZER = 'code-visualizer',
  WASM_DEMOS = 'wasm-demos',
  SHADER_PLAYGROUND = 'shader-playground'
}

export interface NavigationState {
  currentSection: SectionType
  previousSection: SectionType | null
  isTransitioning: boolean
  transitionProgress: number
}

// 3D Scene types
export interface Scene3DConfig {
  id: string
  name: string
  component: React.ComponentType
  preloadAssets?: string[]
  qualityLevels: QualityLevel[]
}

export interface TransitionOptions {
  duration: number
  easing: string
  direction?: 'forward' | 'backward'
}
